async function fetchJson(url, friendlyName = 'Daten') {
    const response = await fetch(url);
    const text = await response.text();
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    if (!response.ok) {
        throw new Error(`${friendlyName} konnten nicht geladen werden (${response.status} ${response.statusText}). Antwort: ${snippet || 'leer'}`);
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error(`${friendlyName} ungültig (${err.message}). Antwort beginnt mit: ${snippet || 'leer'}`);
    }
}

async function loadData() {
    const dataUrl = new URL('data/data.json', document.baseURI).toString();
    return fetchJson(dataUrl, 'Stammdaten');
}



function clamp(value, min, max) {

    return Math.max(min, Math.min(max, value));

}



function formatNumber(value, digits = 1) {
    return Number(value).toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

let chartScenarioIndex = 0;
let daySeason = 'summer';
let yearChartInstance = null;
let dayChartInstance = null;

const monthlyPVFactors = [0.03, 0.05, 0.11, 0.13, 0.14, 0.13, 0.12, 0.11, 0.09, 0.06, 0.025, 0.015];

const dailyPVShape = [
    0, 0, 0, 0, 0.05, 0.15, 0.30, 0.55, 0.75, 0.95, 1.0, 1.0,
    0.95, 0.85, 0.65, 0.45, 0.25, 0.12, 0.05, 0, 0, 0, 0, 0
];

const dailyHouseholdShape = [
    0.12, 0.10, 0.08, 0.07, 0.08, 0.20, 0.35, 0.25, 0.10, 0.08, 0.10, 0.12,
    0.15, 0.20, 0.25, 0.30, 0.40, 0.45, 0.35, 0.25, 0.20, 0.18, 0.15, 0.12
];

function calculateBreakEvenDynamic(investCost, annualSavingElectric, annualSavingGas, inflationElectric, inflationGas) {
    let sum = 0;
    let years = 0;
    while (sum < investCost && years < 40) {
        const savingElectric = annualSavingElectric * Math.pow(1 + inflationElectric, years);
        const savingGas = annualSavingGas * Math.pow(1 + inflationGas, years);
        sum += savingElectric + savingGas;
        years++;
    }
    return years;
}

function calculateCO2Today(householdElectric, heatingDemand, data) {
    return householdElectric * data.co2.electricity_factor
        + heatingDemand * data.co2.gas_factor;
}

function calculateCO2After(annualConsumption, heatingDemand, scenario, data) {
    const electricityCO2 = annualConsumption * data.co2.electricity_factor;
    const gasCO2 = scenario.includeHeatpump ? 0 : heatingDemand * data.co2.gas_factor;
    return electricityCO2 + gasCO2;
}

function calculateCO2Equivalents(totalSaving20yr, data) {
    const trees = totalSaving20yr / (data.co2_equivalents.tree_kg_per_year * 20);
    const flights = totalSaving20yr / data.co2_equivalents.flight_kg_mallorca;
    const carKm = (totalSaving20yr / data.co2_equivalents.car_kg_per_1000km) * 1000;

    return {
        trees,
        flights,
        carKm
    };
}

function calculateCO2SavingsOverYears(initialSaving, inflationRate, years = 20) {
    let total = 0;
    for (let n = 0; n < years; n++) {
        total += initialSaving * Math.pow(1 + inflationRate, n);
    }
    return total;
}

function calculateSavingsOverYearsDynamic(annualSavingElectric, annualSavingGas, inflationElectric, inflationGas, years = 20) {
    let total = 0;
    for (let n = 0; n < years; n++) {
        const savingElectric = annualSavingElectric * Math.pow(1 + inflationElectric, n);
        const savingGas = annualSavingGas * Math.pow(1 + inflationGas, n);
        total += savingElectric + savingGas;
    }
    return total;
}

function simulateYear(pvKwp, householdKwh, heatpumpElectric, storageKwh, includeHP, includeAC) {
    const results = [];
    const annualPV = pvKwp * 1000;

    for (let m = 0; m < 12; m++) {
        const pv = annualPV * monthlyPVFactors[m];

        let consumption = householdKwh / 12;

        if (includeHP) {
            const winterFactor = [11, 0, 1].includes(m) ? 2.8 : (m < 3 || m > 8 ? 1.2 : 0.3);
            consumption += (heatpumpElectric / 12) * winterFactor;
        }

        if (includeAC && m >= 5 && m <= 8) {
            consumption += 40;
        }

        let selfConsumption;
        if (storageKwh > 0) {
            selfConsumption = Math.min(consumption, pv * 0.75);
        } else {
            selfConsumption = Math.min(consumption, pv * 0.35);
        }

        const gridImport = Math.max(0, consumption - selfConsumption);
        const feedIn = Math.max(0, pv - selfConsumption);

        results.push({
            month: m,
            pv,
            consumption,
            selfConsumption,
            gridImport,
            feedIn
        });
    }
    return results;
}

function simulateDay(pvKwp, householdKwh, hpKwh, storageKwh, includeHP, includeAC) {
    const hours = [...Array(24).keys()];
    const pv = [];
    const load = [];
    const selfUse = [];
    const grid = [];

    const sunrise = daySeason === 'summer' ? 5 : 8.5;
    const sunset = daySeason === 'summer' ? 21 : 16;
    const pvPeakFactor = daySeason === 'summer' ? 1.0 : 0.3;

    hours.forEach((h) => {
        if (h < sunrise || h > sunset) {
            pv[h] = 0;
        } else {
            const midday = (sunrise + sunset) / 2;
            const daylightHours = sunset - sunrise;
            const x = Math.abs(h - midday);
            const bell = Math.max(0, 1 - (x / (daylightHours / 2)) ** 2);
            pv[h] = bell * pvKwp * 0.22 * pvPeakFactor;
        }

        let consumption = (householdKwh / 365 / 24);
        if (h >= 6 && h <= 9) consumption *= 1.4;
        if (h >= 17 && h <= 21) consumption *= 1.7;

        if (includeHP) {
            const hpFactor = (h >= 5 && h <= 9) || (h >= 17 && h <= 23) ? 1.6 : 1.0;
            consumption += (hpKwh / 365 / 24) * hpFactor;
        }
        if (includeAC && h >= 14 && h <= 18) {
            consumption += 0.2 * (householdKwh / 365 / 24);
        }

        const storageBoost = storageKwh > 0 ? 0.75 : 0.35;
        const self = Math.min(consumption, pv[h] * storageBoost);
        const gridImport = consumption - self;

        load[h] = consumption;
        selfUse[h] = self;
        grid[h] = gridImport;
    });

    return hours.map((h) => ({
        hour: h,
        pv: pv[h],
        load: load[h],
        selfConsumption: selfUse[h],
        gridImport: grid[h],
        feedIn: Math.max(0, pv[h] - selfUse[h])
    }));
}

function pickScenarioForCharts(scenarios) {
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
        return null;
    }
    const wpScenario = scenarios.find(
        (s) => typeof s.name === 'string' && (s.name.toLowerCase().includes('waermepumpe') || s.name.toLowerCase().includes('wärmepumpe'))
    );
    return wpScenario || scenarios[scenarios.length - 1];
}

function generateScenarioCurves(scenario, base) {
    const labelsMonth = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const pvMonthly = labelsMonth.map((_, idx) => scenario.pvKwp * 1000 * monthlyPVFactors[idx] * 1.05);
    const loadMonthly = labelsMonth.map(() => base.householdElectric / 12);

    const heatMonthly = labelsMonth.map((_, idx) => {
        if (!scenario.includeHeatpump) return 0;
        if ([10, 11, 0, 1].includes((idx + 1) % 12)) {
            return base.heatpumpElectric * 0.7 / 4;
        }
        return base.heatpumpElectric * 0.3 / 8;
    });

    for (let i = 0; i < loadMonthly.length; i++) {
        loadMonthly[i] += heatMonthly[i];
        if (scenario.includeAircon && i >= 5 && i <= 8) {
            loadMonthly[i] += 60;
        }
    }

    const selfUseMonthly = [];
    const gridMonthly = [];
    for (let i = 0; i < 12; i++) {
        const pv = pvMonthly[i];
        const load = loadMonthly[i];
        const storageBoost = scenario.storageKwh > 0 ? 0.75 : 0.35;
        const self = Math.min(load, pv * storageBoost);
        selfUseMonthly.push(self);
        gridMonthly.push(Math.max(0, load - self));
    }

    const pvDaily = dailyPVShape.map((f) => scenario.pvKwp * 1000 / 365 * f * 1.05);
    const baseDaily = base.householdElectric / 365;
    const loadDaily = dailyHouseholdShape.map((f) => baseDaily * f);

    for (let h = 0; h < 24; h++) {
        if (scenario.includeHeatpump) {
            loadDaily[h] += (base.heatpumpElectric / 365) * ((h >= 5 && h <= 9) || (h >= 17 && h <= 23) ? 1.6 : 1.0);
        }
        if (scenario.includeAircon && h >= 14 && h <= 18) {
            loadDaily[h] += 0.2 * baseDaily;
        }
    }

    const selfUseDaily = [];
    const gridDaily = [];
    for (let h = 0; h < 24; h++) {
        const pv = pvDaily[h];
        const load = loadDaily[h];
        const storageBoost = scenario.storageKwh > 0 ? 0.75 : 0.35;
        const self = Math.min(load, pv * storageBoost);
        selfUseDaily.push(self);
        gridDaily.push(Math.max(0, load - self));
    }

    return {
        pvMonthly,
        loadMonthly,
        selfUseMonthly,
        gridMonthly,
        pvDaily,
        loadDaily,
        selfUseDaily,
        gridDaily
    };
}

function renderYearChart(data, title) {
    const ctxEl = document.getElementById('yearChart');
    if (!ctxEl) return;
    if (!Array.isArray(data) || data.length === 0) {
        ctxEl.innerHTML = '';
        return;
    }
    const ctx = ctxEl.getContext('2d');
    if (yearChartInstance) {
        yearChartInstance.destroy();
    }
    const maxValue = Math.max(
        ...data.flatMap((r) => [r.pv, r.consumption, r.selfConsumption, r.gridImport].map(Number))
    );
    const roundedMax = Number.isFinite(maxValue) ? Math.ceil((maxValue * 1.15) / 250) * 250 : 0;
    const yMax = Math.max(750, roundedMax || 0);
    yearChartInstance = new Chart(ctx, {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `Szenario: ${title || '-'}`, font: { size: 16 } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        stepSize: 250
                    }
                }
            }
        },
        data: {
            labels: ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
            datasets: [
                { label: 'PV', data: data.map((r) => r.pv), borderColor: '#fbc02d', borderWidth: 2 },
                { label: 'Verbrauch', data: data.map((r) => r.consumption), borderColor: '#1976d2', borderWidth: 2 },
                { label: 'Eigenverbrauch', data: data.map((r) => r.selfConsumption), borderColor: '#388e3c', borderWidth: 2 },
                { label: 'Netzbezug', data: data.map((r) => r.gridImport), borderColor: '#d32f2f', borderWidth: 2 }
            ]
        }
    });
}

function renderDayChart(data, title) {
    const ctxEl = document.getElementById('dayChart');
    if (!ctxEl) return;
    if (!Array.isArray(data) || data.length === 0) {
        ctxEl.innerHTML = '';
        return;
    }
    const ctx = ctxEl.getContext('2d');
    if (dayChartInstance) {
        dayChartInstance.destroy();
    }
    const maxValue = Math.max(...data.flatMap((r) => [r.pv, r.load, r.selfConsumption, r.gridImport].map(Number)));
    const roundedMax = Number.isFinite(maxValue) ? Math.ceil((maxValue * 1.2) / 0.5) * 0.5 : 0;
    const yMax = Math.max(1.5, roundedMax || 0);
    dayChartInstance = new Chart(ctx, {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `Szenario: ${title || '-'}`, font: { size: 16 } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        stepSize: 0.5,
                        precision: 1
                    }
                }
            }
        },
        data: {
            labels: data.map((r) => r.hour),
            datasets: [
                { label: 'PV', data: data.map((r) => r.pv), borderColor: '#fbc02d', borderWidth: 2 },
                { label: 'Last', data: data.map((r) => r.load), borderColor: '#1976d2', borderWidth: 2 },
                { label: 'Eigenverbrauch', data: data.map((r) => r.selfConsumption), borderColor: '#388e3c', borderWidth: 2 },
                { label: 'Netzbezug', data: data.map((r) => r.gridImport), borderColor: '#d32f2f', borderWidth: 2 }
            ]
        }
    });
}

function updateChartsForScenario(scenarios) {
    let scenario = scenarios?.[chartScenarioIndex];
    if (!scenario) {
        scenario = pickScenarioForCharts(scenarios);
    }
    if (!scenario) return;
    const name = scenario.name || scenario.label || 'berechnetes Szenario';
    const pvKwp = scenario.pvKwp;
    const hhKwh = scenario.householdElectric || scenario.householdKwh || scenario.annualConsumption;
    const hpKwh = scenario.heatpumpElectric || 0;
    const storage = scenario.batteryRecommended || scenario.storageKwh || 0;
    const useHP = !!scenario.includeHeatpump;
    const useAC = !!scenario.includeAC;
    const yearData = simulateYear(pvKwp, hhKwh, hpKwh, storage, useHP, useAC);
    const dayData = simulateDay(pvKwp, hhKwh, hpKwh, storage, useHP, useAC);
    renderYearChart(yearData, name);
    renderDayChart(dayData, name);
}

function enableScenarioSwitch(scenarios) {
    const switchEl = document.getElementById('scenario-switch');
    if (!switchEl) return;
    switchEl.classList.remove('hidden');
    const buttons = switchEl.querySelectorAll('.scenario-btn');
    buttons.forEach((btn, idx) => {
        btn.disabled = false;
        btn.onclick = () => {
            buttons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            chartScenarioIndex = parseInt(btn.dataset.scenario, 10);
            updateChartsForScenario(scenarios);
        };
        if (idx === chartScenarioIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function enableDayToggle() {
    const toggle = document.getElementById('day-toggle');
    if (!toggle) return;
    toggle.classList.remove('hidden');
    const buttons = toggle.querySelectorAll('.day-btn');
    buttons.forEach((btn) => {
        btn.onclick = () => {
            buttons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            daySeason = btn.dataset.season;
            if (window._scenarios) {
                updateChartsForScenario(window._scenarios);
            }
        };
    });
}

// Export PDF
document.addEventListener('DOMContentLoaded', () => {
    const pdfBtn = document.getElementById('exportPdfBtn');
    if (!pdfBtn) return;

    pdfBtn.addEventListener('click', async () => {
        const scenarios = window._scenarios || [];
        const currentIndex = chartScenarioIndex;

        const page = document.querySelector('.page');
        if (!page) return alert('Keine Ergebnisse gefunden.');

        const pdfContainer = document.createElement('div');
        pdfContainer.classList.add('export-container');

        const header = document.createElement('div');
        header.classList.add('pdf-header');
        header.innerHTML = `
        <img src="logo.png" alt="Logo">
        <h2>Energetische Modernisierung – Ergebnisbericht</h2>
        <p>Erstellt am: ${new Date().toLocaleDateString()}</p>
    `;
        pdfContainer.appendChild(header);

        const clone = page.cloneNode(true);
        clone.querySelectorAll('#exportPdfBtn').forEach((btn) => btn.remove());
        clone.querySelectorAll('canvas').forEach((c) => c.remove());

        clone.querySelectorAll('.scenario-block').forEach((block) => {
            const pb = document.createElement('div');
            pb.classList.add('pdf-pagebreak');
            block.insertAdjacentElement('afterend', pb);
        });

        pdfContainer.appendChild(clone);

        if (scenarios.length) {
            for (let i = 0; i < scenarios.length; i++) {
                chartScenarioIndex = i;
                updateChartsForScenario(scenarios);
                const yearCanvas = document.getElementById('yearChart');
                const dayCanvas = document.getElementById('dayChart');
                const block = document.createElement('div');
                block.classList.add('pdf-pagebreak');
                const title = document.createElement('h3');
                title.textContent = `Charts: ${scenarios[i].name || scenarios[i].label || 'Szenario ' + (i + 1)}`;
                block.appendChild(title);
                [yearCanvas, dayCanvas].forEach((c) => {
                    if (!c) return;
                    const img = new Image();
                    img.classList.add('pdf-chart');
                    img.src = c.toDataURL('image/jpeg', 0.8);
                    block.appendChild(img);
                });
                pdfContainer.appendChild(block);
            }
            chartScenarioIndex = currentIndex;
            updateChartsForScenario(scenarios);
        }

        document.body.appendChild(pdfContainer);

        await html2pdf()
            .set({
                margin: 10,
                filename: 'energetische-modernisierung.pdf',
                html2canvas: {
                    scale: 1.2,
                    letterRendering: true
                },
                jsPDF: {
                    unit: 'pt',
                    format: 'a4',
                    orientation: 'portrait'
                }
            })
            .from(pdfContainer)
            .save();

        pdfContainer.remove();
    });
});

async function loadSubsidies() {
    try {
        const subsidiesUrl = new URL('data/subsidies.json', document.baseURI).toString();
        return await fetchJson(subsidiesUrl, 'Förderdaten');
    } catch (err) {
        console.error('Fehler beim Laden der Förderdaten', err);
        return {};
    }
}



async function determineSubsidies(houseAge, bundesland, userSelections) {

    if (!bundesland) {

        return { baseMessages: [], stateHtml: '' };

    }

    const data = await loadSubsidies();

    const statePrograms = data[bundesland] || null;



    const baseMessages = [

        'Photovoltaik wird bundesweit über 0 % MwSt begünstigt, derzeit gibt es keine direkten Zuschüsse.',

        'Batteriespeicher werden bundesweit derzeit nicht gefördert. Kommunale Programme sind möglich.'

    ];



    if (userSelections.heatpump) {

        if (!Number.isNaN(houseAge) && houseAge < 2024) {

            baseMessages.push('Wärmepumpen sind über die BEG förderfähig, 30–70 % Zuschuss je nach Austausch und Einkommen.');

        } else {

            baseMessages.push('Wärmepumpen im Neubau sind nicht förderfähig.');

        }

    }



    baseMessages.push('Heizungsoptimierung inklusive hydraulischem Abgleich ist mit ca. 15 % förderfähig.');

    baseMessages.push('Dämmung, Fenster, Türen sind als Effizienzmaßnahmen mit ca. 15–20 % förderfähig.');



    let stateHtml = '';

    if (statePrograms) {

        const categories = [

            { key: 'pv', label: 'PV' },

            { key: 'battery', label: 'Batteriespeicher' },

            { key: 'heatpump', label: 'Wärmepumpe' },

            { key: 'heating_optimization', label: 'Heizungsoptimierung' },

            { key: 'building_envelope', label: 'Gebäudehülle' }

        ];



        const entries = [];

        categories.forEach((cat) => {

            const items = statePrograms[cat.key] || [];

            if (items.length > 0) {

                items.forEach((item) => {
                    entries.push(`
                        <div class="subsidy-entry">
                            <strong>${item.title}</strong> (${item.type})
                            <p>${item.description}</p>
                            <a href="${item.link_portal}" target="_blank" rel="noopener noreferrer">Zum Förderportal</a>
                        </div>
                    `);
                });
            }
        });


        if (entries.length > 0) {

            stateHtml = entries.join('');

        } else {

            stateHtml = `<p>Für ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.</p>`;

        }

    } else {

        stateHtml = `<p>Für ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.</p>`;

    }



    return { baseMessages, stateHtml };

}



// Zeigt die Förderprogramme an, basierend auf Bundesland und Hausalter

async function showSubsidies(houseAgeValue, bundesland) {

    const box = document.getElementById('subsidyBox');

    const content = document.getElementById('subsidyContent');

    if (!box || !content) return;



    if (!bundesland) {

        box.style.display = 'none';

        content.innerHTML = '';

        return;

    }



    // Relevante Maßnahmen: PV und Speicher immer, Wärmepumpe vorhanden, Optimierung und Hülle immer sinnvoll

    const userSelections = {

        pv: true,

        battery: true,

        heatpump: true,

        heating_optimization: true,

        building_envelope: true

    };



    let baseMessages = [];

    let stateHtml = '';

    try {

        const result = await determineSubsidies(houseAgeValue, bundesland, userSelections);

        baseMessages = result.baseMessages;

        stateHtml = result.stateHtml;

    } catch (e) {

        box.style.display = 'block';

        content.innerHTML = '<p>Förderdaten nicht verfügbar.</p>';

        return;

    }



    const staticHtml = `

        <div class="subsidy-static">

            <h4>Bundesweite Hinweise</h4>

            <ul>

                ${baseMessages.map((m) => `<li>${m}</li>`).join('')}

            </ul>

        </div>

    `;



    const dynamicHtml = stateHtml

        ? `<div class="subsidy-dynamic"><h4>Programme im Bundesland ${bundesland}</h4>${stateHtml}</div>`

        : `<p>Für dieses Bundesland sind derzeit keine spezifischen Programme hinterlegt. Prüfe zusätzlich die Webseite deiner Landesbank oder Kommune.</p>`;



    content.innerHTML = staticHtml + dynamicHtml;

    box.style.display = 'block';

}



function validateConsumptions() {
    const labels = {
        input_stromverbrauch: 'Haushaltsstrom',
        input_heizwaerme: 'Heizwärmebedarf',
        input_preis_strom: 'Strompreis',
        input_preis_gas: 'Gaspreis',
        input_dachflaeche: 'bebaubare Dachfläche'
    };
    const ids = [
        { id: 'input_stromverbrauch', min: 500, max: 15000 },
        { id: 'input_heizwaerme', min: 2000, max: 40000 },
        { id: 'input_preis_strom', min: 0.10, max: 1.00 },
        { id: 'input_preis_gas', min: 0.05, max: 0.50 },
        { id: 'input_dachflaeche', min: 20, max: 200 }
    ];
    for (const f of ids) {
        const el = document.getElementById(f.id);
        if (!el) continue;
        el.classList.remove('input-error');
        const v = Number(el.value);
        if (Number.isNaN(v) || v < f.min || v > f.max) {
            el.classList.add('input-error');
            const label = labels[f.id] || f.id;
            alert(`Bitte gib einen realistischen Wert für "${label}" ein (${f.min} – ${f.max}).`);
            el.focus();
            return false;
        }
    }
    return true;
}

async function calculateAll() {

    const resultEl = document.getElementById('results');

    try {

        // Vorhandene manuelle Eingaben merken (falls Nutzer sie schon überschrieben hat)
        const prevStromEl = document.getElementById('input_stromverbrauch');
        const prevHeizEl = document.getElementById('input_heizwaerme');
        const prevPreisStromEl = document.getElementById('input_preis_strom');
        const prevPreisGasEl = document.getElementById('input_preis_gas');
        const prevDachEl = document.getElementById('input_dachflaeche');
        const prevValues = {
            strom: prevStromEl && prevStromEl.dataset.userEdited === 'true' ? Number(prevStromEl.value) : null,
            heiz: prevHeizEl && prevHeizEl.dataset.userEdited === 'true' ? Number(prevHeizEl.value) : null,
            preisStrom: prevPreisStromEl && prevPreisStromEl.dataset.userEdited === 'true' ? Number(prevPreisStromEl.value) : null,
            preisGas: prevPreisGasEl && prevPreisGasEl.dataset.userEdited === 'true' ? Number(prevPreisGasEl.value) : null,
            dach: prevDachEl && prevDachEl.dataset.userEdited === 'true' ? Number(prevDachEl.value) : null
        };

        const data = await loadData();
        chartScenarioIndex = 0;



        // Eingaben aus dem Formular

        const houseType = document.getElementById('houseType').value;

        // Realistische Dachflächen je Haustyp
        const dachDefaults = {
            reihenhaus: 50,
            doppelhaus: 70,
            einfamilienhaus: 100
        };

        const dachEl = document.getElementById('input_dachflaeche');
        const roofEdited = dachEl?.dataset.userEdited === 'true';
        let userDach = Number(dachEl?.value);
        // Standard je Haustyp nutzen, solange keine manuelle Überschreibung
        if (!roofEdited) {
            userDach = dachDefaults[houseType];
        }
        if (!Number.isFinite(userDach) || userDach < 20 || userDach > 200) {
            userDach = dachDefaults[houseType];
            if (dachEl) dachEl.removeAttribute('data-user-edited');
        }
        if (dachEl) {
            dachEl.value = userDach;
        }

        const area = Number(document.getElementById('area').value);

        const people = Number(document.getElementById('people').value);

        const insulation = document.getElementById('insulation').value;

        const houseAgeValue = parseInt(document.getElementById('houseAge')?.value, 10);

        const bundesland = document.getElementById('bundesland')?.value || '';

        const airconValue = (document.getElementById('aircon').value || '').toLowerCase();
        const hasAircon = airconValue === 'ja';

        const floorHeatingValue = (document.getElementById('floorHeating').value || '').toLowerCase();
        const hasFloorHeating = floorHeatingValue === 'ja';

        const wallboxValue = (document.getElementById('wallbox')?.value || '').toLowerCase();
        const hasWallbox = wallboxValue === 'ja';

        const feedInTariff = data.prices.feed_in_eur_per_kwh;

        // Neue überschreibbare Eingaben
        // Heizwärmebedarf (Dämmung bereits enthalten)
        const heatingKey = houseType === 'einfamilienhaus' ? 'freistehend' : houseType;
        const heatingPerSqm = data.consumption.heating_per_sqm[heatingKey]?.[insulation]
            ?? data.consumption.heating_per_sqm.reihenhaus?.[insulation]
            ?? 0;

        // Haushaltsstrom (Status quo: ohne Zusatzlasten)
        const householdElectricDefault = people * data.consumption.per_person;
        const heatingDemandDefault = area * heatingPerSqm;
        const householdElectric = Number.isFinite(prevValues.strom) ? prevValues.strom : householdElectricDefault;
        const heatingDemand = Number.isFinite(prevValues.heiz) ? prevValues.heiz : heatingDemandDefault;

        const elPriceDefault = data.prices.electricity_eur_per_kwh;
        const gasPriceDefault = data.prices.gas_eur_per_kwh;
        const elPrice = Number.isFinite(prevValues.preisStrom) ? prevValues.preisStrom : elPriceDefault;
        const gasPrice = Number.isFinite(prevValues.preisGas) ? prevValues.preisGas : gasPriceDefault;
        const roofDefault = dachDefaults[houseType];
        let roofArea = Number.isFinite(prevValues.dach) ? prevValues.dach : userDach;
        if (!Number.isFinite(roofArea) || roofArea < 20 || roofArea > 200) {
            roofArea = roofDefault;
            if (dachEl) dachEl.removeAttribute('data-user-edited');
        }
        if (dachEl) {
            dachEl.value = roofArea;
        }

        const airconUnitCost = data.costs?.aircon_cost ?? data.aircon?.cost_per_unit ?? 0;
        const wallboxUnitCost = data.costs?.wallbox_cost ?? data.wallbox?.cost_per_unit ?? 0;
        const airconCost = hasAircon ? airconUnitCost : 0;
        const wallboxCost = hasWallbox ? wallboxUnitCost : 0;


        if (!area || !people) {

            resultEl.innerHTML = '<p>Bitte alle Pflichtfelder ausfüllen.</p>';

            return;

        }



        // Haushaltsstrom (Status quo: ohne Zusatzlasten)
        const airconExtra = hasAircon ? data.consumption.aircon_extra : 0;
        const wallboxExtra = hasWallbox ? data.consumption.wallbox_extra : 0;

        // Wärmepumpenstrom und Leistung
        let cop = data.heatpump.base_cop;
        if (insulation === 'gut') {
            cop *= data.heatpump.factor_good;
        }
        if (insulation === 'schlecht') {
            cop *= data.heatpump.factor_bad;
        }
        if (hasFloorHeating) {
            cop *= data.heatpump.factor_fbh;
        }
        const heatpumpElectric = heatingDemand / cop;
        const heatpumpPower = heatingDemand / data.heatpump.full_load_hours;


        // Status-quo-Verbrauch (ohne Klima/Wallbox/WP)

        const baselineElectric = householdElectric;
        const baselineGas = heatingDemand;
        const baselineCost = baselineElectric * elPrice + baselineGas * gasPrice;
        const baselineElectricCost = baselineElectric * elPrice;
        const baselineGasCost = baselineGas * gasPrice;


        // Modernisierungs-Verbrauch (mit optionalen Zusatzlasten)
        const modernBaseElectric = householdElectric + airconExtra + wallboxExtra;

        const co2Today = calculateCO2Today(householdElectric, heatingDemand, data);

        // Drei Szenarien
        const scenarios = [
            { label: 'Nur Photovoltaik', includeBattery: false, includeHeatpump: false },
            { label: 'PV + Speicher', includeBattery: true, includeHeatpump: false },
            { label: 'PV + Speicher + Wärmepumpe', includeBattery: true, includeHeatpump: true }
        ].map((scenario) => {

            const includesAircon = hasAircon;
            const includesWallbox = hasWallbox;
            const annualConsumption = modernBaseElectric + (scenario.includeHeatpump ? heatpumpElectric : 0);
            const gasUse = scenario.includeHeatpump ? 0 : heatingDemand;

            // PV sizing an marktübliche Angebotsgrößen angepasst
            const totalElectricDemand = annualConsumption;
            let pvKwpCandidate;
            if (scenario.includeHeatpump) {
                pvKwpCandidate = Math.max(Math.ceil((totalElectricDemand + heatpumpElectric) / 850), 8);
            } else {
                pvKwpCandidate = Math.max(Math.ceil(totalElectricDemand / 800), 6);
            }
            let pvKwp = Math.ceil(pvKwpCandidate * 10) / 10;
            // PV limitieren: Dachfläche / 5 m² pro kWp
            const maxKwpFromRoof = Math.floor(roofArea / 5);

            // Realistische Haustypbegrenzung (12/15/20)
            const pvLimits = { reihenhaus: 12, doppelhaus: 15, einfamilienhaus: 20 };
            const maxKwpHouse = pvLimits[houseType] ?? 15;

            // Finaler erlaubter Wert
            pvKwp = Math.min(pvKwp, maxKwpFromRoof, maxKwpHouse);
            const pvGeneration = pvKwp * data.pv.yield_per_kwp;


            // Speicher sizing (6-14 kWh Clamp)

            const dailyUse = annualConsumption / 365;
            const nightLoad = dailyUse * 0.5;
            const batteryMin = nightLoad * data.battery.recommended_factor_min;
            const batteryMax = nightLoad * data.battery.recommended_factor_max;
            const batteryRecommended = scenario.includeBattery
                ? clamp((batteryMin + batteryMax) / 2, 6, 14)
                : 0;
            const storageKwh = scenario.includeBattery ? batteryRecommended : 0;


            // Kosten

            const pvCost = pvKwp * data.pv.cost_per_kwp;

            const batteryCost = batteryRecommended * data.battery.cost_per_kwh;

            const heatpumpCost = scenario.includeHeatpump ? heatpumpPower * data.heatpump.cost_per_kw : 0;

            const extrasCost = airconCost + wallboxCost;
            const totalCost = pvCost + batteryCost + heatpumpCost + extrasCost;


            const extrasLabel = hasAircon || hasWallbox

                ? `${hasAircon ? `Klimaanlage ${formatNumber(airconCost, 0)} EUR` : ''}${hasAircon && hasWallbox ? ', ' : ''}${hasWallbox ? `Wallbox ${formatNumber(wallboxCost, 0)} EUR` : ''}`

                : 'Klimaanlage/Wallbox nicht ausgewählt';



            // Betriebskosten (mit PV, Einspeisevergütung) - theoretische Bilanz
            const storageBoost = scenario.includeBattery ? 0.7 : 0.35;
            const selfUseTheoretical = Math.min(totalElectricDemand, pvGeneration * storageBoost);
            const feedInTheoretical = Math.max(pvGeneration - selfUseTheoretical, 0);
            const gridImportTheoretical = Math.max(totalElectricDemand - selfUseTheoretical, 0);

            // CO₂ nachher (theoretischer Netzbezug wird später überschrieben)
            const gasNew = scenario.includeHeatpump ? 0 : heatingDemand;
            // Autarkie-Heuristiken (für Anzeige) und realistischen Netzbezug ableiten
            // totalElectricDemand bereits oben ermittelt
            const scenarioResult = {
                label: scenario.label,
                name: scenario.label,
                annualConsumption,
                householdElectric: annualConsumption,
                pvKwp,
                batteryRecommended,
                heatpumpPower: scenario.includeHeatpump ? heatpumpPower : 0,
                heatpumpElectric: scenario.includeHeatpump ? heatpumpElectric : 0,
                gasUse,
                pvCost,
                batteryCost,
                heatpumpCost,
                airconCost,
                wallboxCost,
                extrasLabel,
                totalCost,
                pvHint: `Hinweis: Die PV-Empfehlung basiert auf der angenommenen Dachfläche (${roofArea} m²) und typischen Hausgrenzen (${maxKwpHouse} kWp).`,
                gridImportTheoretical,
                storageKwh,
                includesAircon,
                includesWallbox,
                includeAC: includesAircon,
                includeAircon: includesAircon,
                includeHeatpump: scenario.includeHeatpump
            };
            if (!scenario.includeBattery && !scenario.includeHeatpump) {
                let stromAutarkie = 0.28 + 0.02 * (pvKwp - 2);
                stromAutarkie = Math.max(20, Math.min(45, stromAutarkie * 100));
                scenarioResult.stromAutarky = Math.round(stromAutarkie);
            } else if (scenario.includeBattery && !scenario.includeHeatpump) {
                let stromAutarkie = 0.55 + 0.03 * (pvKwp - 4);
                stromAutarkie = Math.max(45, Math.min(80, stromAutarkie * 100));
                scenarioResult.stromAutarky = Math.round(stromAutarkie);
            } else {
                const minGridShare = 0.20;
                const assumedGrid = Math.max(totalElectricDemand * minGridShare, totalElectricDemand - pvGeneration * 0.8);
                const stromAutarkie = Math.max(0, Math.min(100, ((totalElectricDemand - assumedGrid) / totalElectricDemand) * 100));
                scenarioResult.stromAutarky = Math.round(stromAutarkie);
            }

            // Netzstrom und Einspeisung realistisch aus Autarkie ableiten
            const realAutarky = Math.max(0, Math.min(1, scenarioResult.stromAutarky / 100));
            const gridImportRealistic = Math.round(totalElectricDemand * (1 - realAutarky));
            const selfUseRealistic = Math.max(0, totalElectricDemand - gridImportRealistic);
            const feedInRealistic = Math.max(0, pvGeneration - selfUseRealistic);

            scenarioResult.gridImportTheoretical = gridImportTheoretical;
            scenarioResult.gridImportKwh = gridImportRealistic;
            scenarioResult.gridElectric = gridImportRealistic;
            scenarioResult.feedIn = feedInRealistic;
            scenarioResult.heizAutarky = scenario.includeHeatpump ? 100 : 0;

            // Betriebskosten mit realistischem Netzstrom
            const annualElectricCost = gridImportRealistic * elPrice - feedInRealistic * feedInTariff;
            const annualGasCost = gasUse * gasPrice;
            const annualSavingElectric = baselineElectricCost - annualElectricCost;
            const annualSavingGas = baselineGasCost - annualGasCost;
            const annualCost = annualElectricCost + annualGasCost;
            scenarioResult.annualCost = annualCost;
            scenarioResult.savings = annualSavingElectric + annualSavingGas;
            scenarioResult.savings20yr = calculateSavingsOverYearsDynamic(
                annualSavingElectric,
                annualSavingGas,
                data.inflation.electricity_rate,
                data.inflation.gas_rate,
                20
            );
            scenarioResult.breakEvenDynamic = scenarioResult.savings > 0
                ? calculateBreakEvenDynamic(
                    Math.max(0, totalCost - extrasCost),
                    annualSavingElectric,
                    annualSavingGas,
                    data.inflation.electricity_rate,
                    data.inflation.gas_rate
                )
                : null;

            // CO₂ mit realistischem Netzbezug
            const co2_after = calculateCO2After(gridImportRealistic, gasNew, scenario, data);
            const co2_saving = co2Today - co2_after;
            const co2_saving_20yr = calculateCO2SavingsOverYears(co2_saving, data.inflation.electricity_rate, 20);
            const equivalents = calculateCO2Equivalents(co2_saving_20yr, data);
            scenarioResult.co2_today = co2Today;
            scenarioResult.co2_after = co2_after;
            scenarioResult.co2_saving = co2_saving;
            scenarioResult.co2_saving_20yr = co2_saving_20yr;
            scenarioResult.co2_equivalents = equivalents;

            const totalEnergyScenario = totalElectricDemand + gasNew;
            let householdAutarky = 0;
            if (totalEnergyScenario > 0) {
                householdAutarky = ((totalElectricDemand - scenarioResult.gridImportKwh) / totalEnergyScenario) * 100;
            }
            scenarioResult.householdAutarky = Math.round(householdAutarky);
            scenarioResult.haushaltAutarky = Math.round(householdAutarky);

            return scenarioResult;
        });

        window._scenarios = scenarios;
        enableScenarioSwitch(scenarios);
        enableDayToggle();
        updateChartsForScenario(scenarios);

        // Ausgabe
        const autarkyScenario = scenarios[chartScenarioIndex] || scenarios[scenarios.length - 1];
        let baseHtml = `
            <h2>Ergebnis</h2>
            <div class="verbrauch-edit">
                <h3>Unterstellte Verbräuche / Rahmendaten</h3>

                <label>Haushaltsstrom (kWh/a)
                    <input id="input_stromverbrauch" type="number" min="500" max="15000" value="${Math.round(householdElectric)}">
                </label>

                <label>Heizwärmebedarf (kWh/a)
                    <input id="input_heizwaerme" type="number" min="2000" max="40000" value="${Math.round(heatingDemand)}">
                </label>

                <label>Strompreis (€/kWh)
                    <input id="input_preis_strom" type="number" step="0.01" min="0.10" max="1.00" value="${elPrice.toFixed(2)}">
                </label>

                <label>Gaspreis (€/kWh)
                    <input id="input_preis_gas" type="number" step="0.01" min="0.05" max="0.50" value="${gasPrice.toFixed(2)}">
                </label>

                <label>Realistische bebaubare Dachfläche (m²)
                    <input id="input_dachflaeche" type="number" min="20" max="200" value="${roofArea ?? ''}">
                </label>

                <div class="verbrauch-hinweis">
                    <span class="hinweis-icon">ℹ️</span>
                    Falls Sie Ihre eigenen Energieverbrauchs- oder Dachflächenwerte kennen, tragen Sie diese ein.
                    Alle Berechnungen nutzen automatisch diese Eingaben.
                </div>

                <div class="verbrauch-actions">
                    <button id="btn_recalc_results" class="primary" type="button">Berechnen</button>
                    <button id="btn_reset_defaults" class="primary" type="button">Zurücksetzen</button>
                </div>
            </div>
            <p style="margin-top:8px; font-size:13px; color:#555;">
            Hinweis: Die Standardwerte für Verbrauch, Energiepreise und Dachfläche passen sich automatisch an die Eingaben (Haustyp, Fläche, Personen, Dämmung) an. Eigene Werte können Sie jederzeit überschreiben.
            </p>
            <p>Heutige jährliche Energiekosten (Strom ${formatNumber(elPrice, 2)} EUR/kWh, Gas ${formatNumber(gasPrice, 2)} EUR/kWh): ${formatNumber(baselineCost, 0)} EUR/a</p>

            <h3>Annahmen nach Modernisierung</h3>
            <p>Haushalt (inkl. ggf. Klima/Wallbox): ${formatNumber(modernBaseElectric, 0)} kWh/a${hasAircon ? `, davon Klima +${formatNumber(airconExtra, 0)} kWh/a` : ''}${hasWallbox ? `, Wallbox +${formatNumber(wallboxExtra, 0)} kWh/a` : ''}</p>
            <p>Heizwärmebedarf bleibt: ${formatNumber(heatingDemand, 0)} kWh/a;</p>
            <p>Wärmepumpen-Strom (falls WP): ${formatNumber(heatpumpElectric, 0)} kWh/a,</p>
            <p>WP-Leistung: ${formatNumber(heatpumpPower, 1)} kW</p>

            <h3>Szenarien (${hasAircon ? 'mit Klimaanlage' : 'ohne Klimaanlage'}, ${hasWallbox ? 'mit Wallbox' : 'ohne Wallbox'})</h3>
            ${scenarios.map((s) => `
                <div class="scenario scenario-block">
                    <h4>${s.label}</h4>
                    <p>Gesamtstrombedarf: ${formatNumber(s.annualConsumption, 0)} kWh/a</p>
                    <p>Netzstrombezug: ${formatNumber(s.gridElectric, 0)} kWh/a</p>
                    <p>Gasbedarf: ${formatNumber(s.gasUse, 0)} kWh/a</p>
                    <p>Einspeisung: ${formatNumber(s.feedIn, 0)} kWh/a (Tarif ${formatNumber(feedInTariff, 2)} EUR/kWh)</p>
                    <p>PV-Empfehlung: ${formatNumber(s.pvKwp, 1)} kWp</p>
                    <p>Speicher-Empfehlung: ${s.batteryRecommended ? formatNumber(s.batteryRecommended, 1) + ' kWh' : 'kein Speicher'}</p>
                    <p>Wärmepumpe: ${s.heatpumpPower ? `${formatNumber(s.heatpumpPower, 1)} kW (Strom ${formatNumber(s.heatpumpElectric, 0)} kWh/a)` : 'keine WP'}</p>
                    <div class="cost-block">
                        <strong>Kosten:</strong><br>
                        PV (2025 Marktpreis ~1.850-2.400 EUR/kWp): ${formatNumber(s.pvCost, 0)} EUR<br>
                        Speicher (ca. 650-750 EUR/kWh): ${formatNumber(s.batteryCost, 0)} EUR<br>
                        Wärmepumpe: ${formatNumber(s.heatpumpCost, 0)} EUR<br>
                        ${s.extrasLabel}<br>
                        Gesamt: ${formatNumber(s.totalCost, 0)} EUR
                    </div>
                    ${(() => {
                        const eq = s.co2_equivalents || {};
                        const co2ValuesValid = [s.co2_today, s.co2_after, s.co2_saving, s.co2_saving_20yr, eq.trees, eq.flights, eq.carKm]
                            .every((v) => Number.isFinite(v));
                        if (!co2ValuesValid) return '';
                        const treesRounded = Math.round(eq.trees);
                        const flightsRounded = Math.round(eq.flights);
                        const carKmRounded = Math.round(eq.carKm);
                        return `
                            <div class="co2-box">
                                <h4>🌍 CO₂-Bilanz</h4>
                                <p>Heute: ${formatNumber(s.co2_today, 0)} kg CO₂/a</p>
                                <p>Nachher: ${formatNumber(s.co2_after, 0)} kg CO₂/a</p>
                                <p><strong>Einsparung: ${formatNumber(s.co2_saving, 0)} kg CO₂/a</strong></p>
                                <p>20-Jahres-Einsparung (mit Energiepreissteigerung): ${formatNumber(s.co2_saving_20yr, 0)} kg</p>
                                <hr>
                                <p>≈ ${treesRounded} Bäume</p>
                                <p>≈ ${formatNumber(flightsRounded, 0)} Mallorca-Flüge (Hin- und Rückflug)</p>
                                <p>≈ ${formatNumber(carKmRounded, 0)} km Autofahren (Verbrenner)</p>
                                <p class="note">Hinweis: Die CO₂-Emissionen aus der Herstellung der Photovoltaikanlage werden nicht berücksichtigt, was die Bilanz geringfügig verändern würde.</p>
                            </div>
                        `;
                    })()}
                    <div class="autarkie-card">
                        <h5>Autarkie im Szenario</h5>
                        <div class="autarkie-row">
                            <span class="autarkie-icon">⚡</span>
                            <span class="autarkie-label">Strom-Autarkie</span>
                            <span class="autarkie-value">${formatNumber(s.stromAutarky, 0)} %</span>
                        </div>
                        <div class="autarkie-bar">
                            <div class="autarkie-fill strom" style="width:${clamp(s.stromAutarky, 0, 100)}%"></div>
                        </div>
                        <div class="autarkie-row">
                            <span class="autarkie-icon">🔥</span>
                            <span class="autarkie-label">Heiz-Autarkie</span>
                            <span class="autarkie-value">${formatNumber(s.heizAutarky, 0)} %</span>
                        </div>
                        <div class="autarkie-bar">
                            <div class="autarkie-fill heizung" style="width:${clamp(s.heizAutarky, 0, 100)}%"></div>
                        </div>
                        <div class="autarkie-row">
                            <span class="autarkie-icon">🏠</span>
                            <span class="autarkie-label">Haushalts-Autarkie (Strom + Heizung)</span>
                            <span class="autarkie-value">${formatNumber(s.haushaltAutarky, 0)} %</span>
                        </div>
                        <div class="autarkie-bar">
                            <div class="autarkie-fill haushalt" style="width:${clamp(s.haushaltAutarky, 0, 100)}%"></div>
                        </div>
                    </div>
                    <p>Betriebskosten mit PV/WP: ${formatNumber(s.annualCost, 0)} EUR/a | Einsparung ggü. heute: ${formatNumber(s.savings, 0)} EUR/a${s.breakEvenDynamic ? ` | Break-even (mit Energiepreissteigerung): ca. ${formatNumber(s.breakEvenDynamic, 1)} Jahre` : ''}</p>
                </div>
            `).join('')}
            <div class="autarkie-info">
                <strong>Hinweis zur Autarkie:</strong><br>
                Die Strom-Autarkie zeigt, wie viel des Strombedarfs du selbst deckst.<br>
                Die Heiz-Autarkie zeigt, ob deine Wärmeversorgung autark ist.<br>
                Die Haushalts-Autarkie kombiniert Strom und Heizung und zeigt deine energetische Gesamtsouveränität.
            </div>
            <div class="zaehler-info">
                <strong>Hinweis: Elektro / Zählerschrank:</strong><br>
                Bei vielen Bestandsgebäuden kann der Zählerschrank angepasst oder erweitert werden müssen.<br>
                Dies betrifft insbesondere PV-Anlagen, Batteriespeicher oder Wärmepumpen.<br>
                Typischer Kostenpuffer: <strong>1.500–3.000 EUR</strong>.
            </div>

        `;

        resultEl.innerHTML = baseHtml;
        const resetValuesBtn = document.getElementById('btn_reset_defaults');
        if (resetValuesBtn) {
            resetValuesBtn.addEventListener('click', () => {
                const defaultsRoof = { reihenhaus: 50, doppelhaus: 70, einfamilienhaus: 100 };
                const strom = document.getElementById('input_stromverbrauch');
                const heiz = document.getElementById('input_heizwaerme');
                const stromPreis = document.getElementById('input_preis_strom');
                const gasPreis = document.getElementById('input_preis_gas');
                const dach = document.getElementById('input_dachflaeche');
                const stromDefault = householdElectricDefault;
                const heizDefault = heatingDemandDefault;
                if (strom) { strom.value = stromDefault; strom.removeAttribute('data-user-edited'); }
                if (heiz) { heiz.value = heizDefault; heiz.removeAttribute('data-user-edited'); }
                if (stromPreis) { stromPreis.value = elPriceDefault; stromPreis.removeAttribute('data-user-edited'); }
                if (gasPreis) { gasPreis.value = gasPriceDefault; gasPreis.removeAttribute('data-user-edited'); }
                if (dach) { dach.value = defaultsRoof[houseType]; dach.removeAttribute('data-user-edited'); }
            });
        }
        const recalcBtn = document.getElementById('btn_recalc_results');
        if (recalcBtn) {
            recalcBtn.addEventListener('click', () => {
                // Werte aus den Feldern übernehmen und als manuell markiert
                ['input_stromverbrauch', 'input_heizwaerme', 'input_preis_strom', 'input_preis_gas', 'input_dachflaeche'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.dataset.userEdited = 'true';
                    }
                });
                if (!validateConsumptions()) return;
                calculateAll();
            });
        }
        const pdfBtn = document.getElementById('exportPdfBtn');
        if (pdfBtn) {
            pdfBtn.style.display = 'block';
        }
        // Markiere manuelle Eingaben
        ['input_stromverbrauch', 'input_heizwaerme', 'input_preis_strom', 'input_preis_gas', 'input_dachflaeche'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    el.dataset.userEdited = 'true';
                });
            }
        });
        await showSubsidies(houseAgeValue, bundesland);
    } catch (err) {

        resultEl.innerHTML = `<p>Fehler: ${err.message}</p>`;

    }

}



const calcBtn = document.getElementById('calcBtn');
if (calcBtn) {
    calcBtn.addEventListener('click', () => {
        if (!validateConsumptions()) return;
        calculateAll();
    });
}

const resetBtn = document.getElementById('resetBtn');

if (resetBtn) {

    resetBtn.addEventListener('click', () => {

        const houseTypeSelect = document.getElementById('houseType');
        if (houseTypeSelect) houseTypeSelect.value = 'reihenhaus';

        const areaSelect = document.getElementById('area');
        if (areaSelect) areaSelect.value = '100';

        document.getElementById('people').value = '2';

        const houseAge = document.getElementById('houseAge');

        if (houseAge) houseAge.value = '';

        document.getElementById('insulation').value = 'normal';

        document.getElementById('floorHeating').value = 'Nein';

        document.getElementById('aircon').value = 'Nein';

        const wallbox = document.getElementById('wallbox');

        if (wallbox) wallbox.value = 'Nein';

        const bundesland = document.getElementById('bundesland');

        if (bundesland) bundesland.value = '';

        document.getElementById('results').innerHTML = '';

    });

}

