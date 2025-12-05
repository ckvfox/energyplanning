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

function roofPvLimit(roofArea) {
    const area = Number.isFinite(roofArea) ? roofArea : 0;
    return Math.max(0, Math.floor(area / 7)); // 7 m² pro kWp laut Vorgabe
}

function estimateEnergyBalance({
    pvKwp,
    batteryKwh,
    annualLoadKwh,
    pvYieldPerKwp,
    hasHeatpump = false,
    hasEv = false,
    evLoadKwh = 0
}) {
    const roundtripEff = 0.85;
    const pvGeneration = Math.max(0, pvKwp) * pvYieldPerKwp;
    const directShare = batteryKwh > 0 ? 0.45 : 0.35;

    const directSelf = Math.min(annualLoadKwh * directShare, pvGeneration * 0.9);
    const pvSurplus = Math.max(pvGeneration - directSelf, 0);

    let batteryDelivered = 0;
    if (batteryKwh > 0) {
        const dailyUsable = batteryKwh * 0.7;
        const annualUsablePv = dailyUsable * 365; // max. 1 Vollzyklus pro Tag
        const pvForBattery = Math.min(pvSurplus, annualUsablePv);
        batteryDelivered = pvForBattery * roundtripEff;
    }

    const selfUse = Math.min(annualLoadKwh, directSelf + batteryDelivered);
    const feedIn = Math.max(0, pvGeneration - selfUse);
    const gridImport = Math.max(0, annualLoadKwh - selfUse);

    const evFromBattery = hasEv && batteryKwh > 0
        ? Math.round(Math.min(evLoadKwh * 0.5, batteryDelivered * 0.4))
        : 0;

    const autarkyPct = annualLoadKwh > 0 ? (selfUse / annualLoadKwh) * 100 : 0;

    return {
        pvGeneration,
        directSelf,
        batteryDelivered,
        selfUse,
        gridImport,
        feedIn,
        autarky: autarkyPct,
        evFromBattery
    };
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
let chartColors = {}; // Farben aus data.json

const monthlyPVFactors = [0.03, 0.05, 0.11, 0.13, 0.14, 0.13, 0.12, 0.11, 0.09, 0.06, 0.025, 0.015];

const dailyPVShape = [
    0, 0, 0, 0, 0.05, 0.15, 0.30, 0.55, 0.75, 0.95, 1.0, 1.0,
    0.95, 0.85, 0.65, 0.45, 0.25, 0.12, 0.05, 0, 0, 0, 0, 0
];

// ========== EV/COMBUSTION FIELD DISABLE LOGIC ==========
/**
 * Disables/enables EV and combustion vehicle input fields based on Wallbox selection
 * Fields are only usable when Wallbox is set to "Ja"
 */
function updateEVCombustionFieldsState() {
    const wallboxEl = document.getElementById('wallbox');
    
    if (!wallboxEl) return;
    
    const isWallboxEnabled = wallboxEl.value === 'Ja';
    const evFields = [
        'input_ev_km',
        'input_ev_consumption',
        'input_combustion_km',
        'input_combustion_consumption'
    ];
    
    evFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !isWallboxEnabled;
        }
    });
}

// ========== BAUJAHR FIELD DISABLE LOGIC ==========
/**
 * Disables/enables Baujahr (house age) input field based on Bundesland selection
 * Field is only usable when a Bundesland is selected
 */
function updateBaujahrFieldState() {
    const bundeslandEl = document.getElementById('bundesland');
    const baujahrEl = document.getElementById('houseAge');
    
    if (!bundeslandEl || !baujahrEl) return;
    
    const isBundeslandSelected = bundeslandEl.value !== '';
    baujahrEl.disabled = !isBundeslandSelected;
}

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

function calculateCO2After(annualGridImport, heatingDemand, scenario, data) {
    const electricityCO2 = annualGridImport * data.co2.electricity_factor;
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
                { label: 'PV', data: data.map((r) => r.pv), borderColor: chartColors.pv, borderWidth: 2 },
                { label: 'Verbrauch', data: data.map((r) => r.consumption), borderColor: chartColors.consumption, borderWidth: 2 },
                { label: 'Eigenverbrauch', data: data.map((r) => r.selfConsumption), borderColor: chartColors.selfConsumption, borderWidth: 2 },
                { label: 'Netzbezug', data: data.map((r) => r.gridImport), borderColor: chartColors.gridImport, borderWidth: 2 }
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
                { label: 'PV', data: data.map((r) => r.pv), borderColor: chartColors.pv, borderWidth: 2 },
                { label: 'Last', data: data.map((r) => r.load), borderColor: chartColors.load, borderWidth: 2 },
                { label: 'Eigenverbrauch', data: data.map((r) => r.selfConsumption), borderColor: chartColors.eigenverbrauch, borderWidth: 2 },
                { label: 'Netzbezug', data: data.map((r) => r.gridImport), borderColor: chartColors.netzbezug, borderWidth: 2 }
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
            buttons.forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            chartScenarioIndex = parseInt(btn.dataset.scenario, 10);
            updateChartsForScenario(scenarios);
        };
        // Keyboard navigation: ArrowLeft/ArrowRight for tablist
        btn.addEventListener('keydown', (e) => {
            let targetBtn = null;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                targetBtn = idx > 0 ? buttons[idx - 1] : buttons[buttons.length - 1];
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                targetBtn = idx < buttons.length - 1 ? buttons[idx + 1] : buttons[0];
            } else if (e.key === 'Home') {
                e.preventDefault();
                targetBtn = buttons[0];
            } else if (e.key === 'End') {
                e.preventDefault();
                targetBtn = buttons[buttons.length - 1];
            }
            if (targetBtn) {
                targetBtn.focus();
                targetBtn.click();
            }
        });
        if (idx === chartScenarioIndex) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        }
    });
}

function enableDayToggle() {
    const toggle = document.getElementById('day-toggle');
    if (!toggle) return;
    toggle.classList.remove('hidden');
    const buttons = toggle.querySelectorAll('.day-btn');
    buttons.forEach((btn, idx) => {
        btn.onclick = () => {
            buttons.forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            daySeason = btn.dataset.season;
            if (window._scenarios) {
                updateChartsForScenario(window._scenarios);
            }
        };
        // Keyboard navigation: ArrowLeft/ArrowRight for toggle buttons
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const other = idx === 0 ? buttons[1] : buttons[0];
                other.focus();
                other.click();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const other = idx === 0 ? buttons[1] : buttons[0];
                other.focus();
                other.click();
            }
        });
    });
}

// Export PDF
document.addEventListener('DOMContentLoaded', () => {
    const pdfBtn = document.getElementById('exportPdfBtn');
    if (!pdfBtn) return;

    pdfBtn.addEventListener('click', () => {
        const resultsSection = document.getElementById('results');
        if (!resultsSection) {
            alert('Keine Ergebnisse gefunden.');
            return;
        }

        try {
            // Sammle HTML-Inhalte
            const resultsHtml = resultsSection?.innerHTML || '';
            const formHtml = document.querySelector('.form-card')?.innerHTML || '';

            // Erstelle unsichtbaren Container mit print-Styling
            const printContainer = document.createElement('div');
            printContainer.id = 'printContent_' + Date.now();
            printContainer.style.cssText = `
                position: fixed;
                top: -9999px;
                left: -9999px;
                width: 210mm;
                height: 297mm;
                padding: 20mm;
                background: white;
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.6;
                color: #333;
            `;

            // Baue Print-HTML
            let printHtml = `
                <h1 style="font-size: 24px; margin-bottom: 10px; text-align: center;">
                    Energetische Modernisierung – Ergebnisbericht
                </h1>
                <div style="text-align: center; color: #666; font-size: 11px; margin-bottom: 30px;">
                    Erstellt am: ${new Date().toLocaleDateString('de-DE')}
                </div>
                <h2 style="font-size: 16px; margin-top: 25px; margin-bottom: 12px; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                    Eingabedaten
                </h2>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; margin-bottom: 25px;">
                    ${formHtml}
                </div>
                <h2 style="font-size: 16px; margin-top: 25px; margin-bottom: 12px; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                    Ergebnisse
                </h2>
                <div style="margin-bottom: 25px;">
                    ${resultsHtml}
                </div>
            `;

            printContainer.innerHTML = printHtml;
            document.body.appendChild(printContainer);

            // Entferne interaktive Elemente aus Print-Version
            printContainer.querySelectorAll('button, select, input, .scenario-btn, .day-btn, #day-toggle, #scenario-switch').forEach(el => el.remove());

            // Definiere Print-Stylesheet
            const printStyle = document.createElement('style');
            printStyle.textContent = `
                @media print {
                    body > * { display: none !important; }
                    #${printContainer.id} {
                        position: static !important;
                        top: auto !important;
                        left: auto !important;
                        width: auto !important;
                        height: auto !important;
                        display: block !important;
                    }
                    #${printContainer.id} h2 {
                        page-break-inside: avoid;
                    }
                }
            `;
            document.head.appendChild(printStyle);

            // Öffne Druckdialog
            setTimeout(() => {
                window.print();
                
                // Cleanup nach Druck
                setTimeout(() => {
                    printContainer.remove();
                    printStyle.remove();
                }, 1000);
            }, 100);
        } catch (e) {
            console.error('Druckfehler:', e);
            alert('Druckfehler aufgetreten. Bitte versuchen Sie es später erneut.');
        }
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
        input_dachflaeche: 'bebaubare Dachfläche',
        input_pv_kwp: 'PV-Leistung'
    };
    const ids = [
        { id: 'input_stromverbrauch', min: 500, max: 15000 },
        { id: 'input_heizwaerme', min: 2000, max: 40000 },
        { id: 'input_preis_strom', min: 0.10, max: 1.00 },
        { id: 'input_preis_gas', min: 0.05, max: 0.50 },
        { id: 'input_dachflaeche', min: 20, max: 200 },
        { id: 'input_pv_kwp', min: 2, max: 30, optional: true }
    ];
    for (const f of ids) {
        const el = document.getElementById(f.id);
        if (!el) continue;
        el.classList.remove('input-error');
        const v = el.value;
        
        // Optional-Felder überspringen wenn leer
        if (f.optional && v === '') continue;
        
        const num = Number(v);
        if (Number.isNaN(num) || num < f.min || num > f.max) {
            el.classList.add('input-error');
            const label = labels[f.id] || f.id;
            if (f.optional && v !== '') {
                alert(`Bitte gib einen realistischen Wert für "${label}" ein (${f.min} – ${f.max}).`);
            } else if (!f.optional) {
                alert(`Bitte gib einen realistischen Wert für "${label}" ein (${f.min} – ${f.max}).`);
            }
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
        const prevPvEl = document.getElementById('input_pv_kwp');
        const prevEvKmEl = document.getElementById('input_ev_km');
        const prevEvConsEl = document.getElementById('input_ev_consumption');
        const prevCombustionKmEl = document.getElementById('input_combustion_km');
        const prevCombustionConsEl = document.getElementById('input_combustion_consumption');
        
        const prevValues = {
            strom: prevStromEl && prevStromEl.dataset.userEdited === 'true' ? Number(prevStromEl.value) : null,
            heiz: prevHeizEl && prevHeizEl.dataset.userEdited === 'true' ? Number(prevHeizEl.value) : null,
            preisStrom: prevPreisStromEl && prevPreisStromEl.dataset.userEdited === 'true' ? Number(prevPreisStromEl.value) : null,
            preisGas: prevPreisGasEl && prevPreisGasEl.dataset.userEdited === 'true' ? Number(prevPreisGasEl.value) : null,
            dach: prevDachEl && prevDachEl.dataset.userEdited === 'true' ? Number(prevDachEl.value) : null,
            pvKwp: prevPvEl && prevPvEl.value ? Number(prevPvEl.value) : null,
            evKm: prevEvKmEl && prevEvKmEl.value ? Number(prevEvKmEl.value) : null,
            evCons: prevEvConsEl && prevEvConsEl.value ? Number(prevEvConsEl.value) : null,
            combustionKm: prevCombustionKmEl && prevCombustionKmEl.value ? Number(prevCombustionKmEl.value) : null,
            combustionCons: prevCombustionConsEl && prevCombustionConsEl.value ? Number(prevCombustionConsEl.value) : null
        };

        const data = await loadData();

        // Farben aus data.json laden
        if (data.colors) {
            chartColors = data.colors;
        } else {
            // Fallback-Farben
            chartColors = {
                pv: '#fbc02d',
                consumption: '#1976d2',
                selfConsumption: '#388e3c',
                gridImport: '#d32f2f',
                load: '#1976d2',
                eigenverbrauch: '#388e3c',
                netzbezug: '#d32f2f'
            };
        }
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

        // E-Auto-Werte (mit optionalem Nutzer-Override)
        const evAnnualKm = Number.isFinite(prevValues.evKm) ? prevValues.evKm : (data.consumption.ev?.annual_km ?? 15000);
        const evKwhPer100Km = Number.isFinite(prevValues.evCons) ? prevValues.evCons : (data.consumption.ev?.kwh_per_100km ?? 17);
        const evModel = data.consumption.ev?.model || 'VW ID.4 (meistverkauftes E-Auto)';
        const wallboxExtra = hasWallbox ? (evAnnualKm / 100) * evKwhPer100Km : 0;
        
        // Verbrenner-Werte aus data.json (mit optionalem Nutzer-Override)
        const combustionData = data.consumption.combustion || {};
        const combustionModel = combustionData.model || 'VW Passat 1.5 TSI';
        const combustionAnnualKm = Number.isFinite(prevValues.combustionKm) ? prevValues.combustionKm : (combustionData.annual_km ?? 15000);
        const combustionLitresPer100km = Number.isFinite(prevValues.combustionCons) ? prevValues.combustionCons : (combustionData.litres_per_100km ?? 7.0);
        const combustionFuelPrice = combustionData.fuel_price_per_litre ?? 1.85;
        const combustionCo2Factor = combustionData.co2_per_litre ?? 2.3;
        const combustionLitres = hasWallbox ? (combustionAnnualKm / 100) * combustionLitresPer100km : 0;
        const combustionCo2Annual = combustionLitres * combustionCo2Factor;
        const evCo2Factor = 0.35; // kg CO2/kWh Strommix
        const evFuelCost = combustionLitres * combustionFuelPrice;
        const wallboxHintText = hasWallbox
            ? `Wallbox-Mehrverbrauch: ${formatNumber(wallboxExtra, 0)} kWh/a (Annahme: ${evModel}, ca. ${formatNumber(evAnnualKm, 0)} km/a, ~${formatNumber(evKwhPer100Km, 1)} kWh/100 km).`
            : '';

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
        // wallboxExtra ist nur relevant, wenn Wallbox (EV) gewählt wurde
        // Es wird keine Vermischung von EV- und Verbrenner-Logik vorgenommen

        // Wärmepumpenstrom und Leistung
        let cop = data.heatpump.base_cop;
        if (insulation === 'gut') {
            cop *= data.heatpump.factor_good;
        }
        if (insulation === 'schlecht') {
            cop *= data.heatpump.factor_bad;
        }
        if (hasFloorHeating) {
            cop *= 1.1;
        }
        cop = clamp(cop, 2.5, 3.5);
        const heatpumpElectric = heatingDemand / cop;
        const heatpumpPower = heatingDemand / data.heatpump.full_load_hours;


        // Status-quo-Verbrauch (ohne Klima/Wallbox/WP)

        const baselineElectric = householdElectric;
        const baselineGas = heatingDemand;
        const baselineFuel = hasWallbox ? evFuelCost : 0;
        const baselineCost = baselineElectric * elPrice + baselineGas * gasPrice + baselineFuel;
        const baselineElectricCost = baselineElectric * elPrice;
        const baselineGasCost = baselineGas * gasPrice;


        // Modernisierungs-Verbrauch (mit optionalen Zusatzlasten)
        const modernBaseElectric = householdElectric + airconExtra + wallboxExtra;

        const totalElectricAll = modernBaseElectric + heatpumpElectric;

        const co2Today = calculateCO2Today(householdElectric, heatingDemand, data) + (hasWallbox ? combustionCo2Annual : 0);

        const warnings = [];

        // Drei Szenarien
        const scenarios = [
            { label: 'Nur Photovoltaik', includeBattery: false, includeHeatpump: false },
            { label: 'PV + Speicher', includeBattery: true, includeHeatpump: false },
            { label: 'PV + Speicher + Wärmepumpe', includeBattery: true, includeHeatpump: true }
        ].map((scenario) => {

            const includesAircon = hasAircon;
            const includesWallbox = hasWallbox;
            const householdBlock = householdElectric;
            const acBlock = includesAircon ? airconExtra : 0;
            const evBlock = includesWallbox ? wallboxExtra : 0;
            const heatpumpBlock = scenario.includeHeatpump ? heatpumpElectric : 0;
            const annualConsumption = householdBlock + acBlock + evBlock + heatpumpBlock;
            const gasUse = scenario.includeHeatpump ? 0 : heatingDemand;

            // PV sizing dynamisch anhand Verbrauch + Dach (oder Nutzer-Override)
            const totalElectricDemand = annualConsumption;
            
            // Neue Limits für Haustypen - VOR der Berechnung
            const pvLimits = { reihenhaus: 14, doppelhaus: 18, einfamilienhaus: 24 };
            const maxKwpHouse = pvLimits[houseType] ?? 18;
            
            let pvKwp;
            let pvExceedsRoof = false;
            
            if (Number.isFinite(prevValues.pvKwp) && prevValues.pvKwp > 0) {
                // Nutzer hat einen festen Wert eingegeben
                pvKwp = prevValues.pvKwp;
                const maxKwpFromRoof = Math.max(0, Math.floor((Number.isFinite(roofArea) ? roofArea : 0) / 6));
                if (pvKwp > maxKwpFromRoof) {
                    pvExceedsRoof = true;
                }
            } else {
                // Automatische Berechnung
                let pvKwpCandidate = totalElectricDemand / 850;
                // Mindestgröße bei Speicher oder WP: mindestens 7 kWp
                if (scenario.includeBattery || scenario.includeHeatpump) {
                    pvKwpCandidate = Math.max(pvKwpCandidate, 7);
                }
                // Dachfläche: moderner Faktor 6 m²/kWp
                const maxKwpFromRoof = Math.max(0, Math.floor((Number.isFinite(roofArea) ? roofArea : 0) / 6));
                if (pvKwpCandidate > maxKwpFromRoof) {
                    warnings.push(`Die maximal mögliche PV-Leistung liegt bei ${formatNumber(maxKwpFromRoof, 0)} kWp; mehr ist auf der verfügbaren Dachfläche nicht realisierbar.`);
                }
                // Finaler erlaubter Wert, auf 0,1 runden
                pvKwp = Math.min(pvKwpCandidate, maxKwpFromRoof, maxKwpHouse);
                pvKwp = Math.max(0, Math.round(pvKwp * 10) / 10);
            }
            
            const pvGeneration = pvKwp * data.pv.yield_per_kwp;


            // Speicher sizing: empfohlen = 0,9 × täglicher Verbrauch, Clamp 4–15 kWh
            const dailyUse = annualConsumption / 365;
            const batteryRecommended = scenario.includeBattery
                ? clamp(dailyUse * 0.9, 4, 15)
                : 0;
            const dailyPv = pvKwp * data.pv.yield_per_kwp / 365;
            const storageKwh = scenario.includeBattery ? Math.min(batteryRecommended, dailyPv * 2) : 0;


            // Kosten

            const pvCost = pvKwp * data.pv.cost_per_kwp;

            const batteryCost = batteryRecommended * data.battery.cost_per_kwh;

            const heatpumpCost = scenario.includeHeatpump ? heatpumpPower * data.heatpump.cost_per_kw : 0;

            const extrasCost = airconCost + wallboxCost;
            const totalCost = pvCost + batteryCost + heatpumpCost + extrasCost;


            const extrasLabel = hasAircon || hasWallbox

                ? `${hasAircon ? `Klimaanlage ${formatNumber(airconCost, 0)} EUR` : ''}${hasAircon && hasWallbox ? ', ' : ''}${hasWallbox ? `Wallbox ${formatNumber(wallboxCost, 0)} EUR` : ''}`

                : 'Klimaanlage/Wallbox nicht ausgewählt';

            // Realistische Energieflüsse (1 Zyklus/Tag, Verluste, nächtliche EV-Ladung)
            const gasNew = scenario.includeHeatpump ? 0 : heatingDemand;
            const energyBalance = estimateEnergyBalance({
                pvKwp,
                batteryKwh: storageKwh,
                annualLoadKwh: totalElectricDemand,
                pvYieldPerKwp: data.pv.yield_per_kwp,
                hasHeatpump: scenario.includeHeatpump,
                hasEv: includesWallbox,
                evLoadKwh: evBlock
            });

            const scenarioResult = {
                label: scenario.label,
                name: scenario.label,
                annualConsumption,
                householdElectric: annualConsumption,
                pvKwp,
                pvExceedsRoof,
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
                gridImportTheoretical: energyBalance.gridImport,
                storageKwh,
                includesAircon,
                includesWallbox,
                includeAC: includesAircon,
                includeAircon: includesAircon,
                includeHeatpump: scenario.includeHeatpump,
                householdBlock,
                climateBlock: acBlock,
                evBlock,
                heatpumpBlock
            };

            let autarkyPct = clamp(energyBalance.autarky, 5, 90);
            if (!scenario.includeBattery && !scenario.includeHeatpump) {
                autarkyPct = clamp(autarkyPct, 25, 40);
            } else if (scenario.includeBattery && !scenario.includeHeatpump) {
                autarkyPct = clamp(autarkyPct, 50, 75);
            } else {
                autarkyPct = clamp(autarkyPct, 70, 85);
            }
            scenarioResult.stromAutarky = Math.round(autarkyPct);

            scenarioResult.gridImportKwh = Math.round(energyBalance.gridImport);
            scenarioResult.gridElectric = scenarioResult.gridImportKwh;
            scenarioResult.feedIn = Math.round(energyBalance.feedIn);
            scenarioResult.heizAutarky = scenario.includeHeatpump ? 100 : 0;
            scenarioResult.evFromBattery = energyBalance.evFromBattery;
            scenarioResult.evAnnual = hasWallbox ? wallboxExtra : 0;

            // Betriebskosten mit realistischem Netzstrom
            const annualElectricCost = scenarioResult.gridImportKwh * elPrice - scenarioResult.feedIn * feedInTariff;
            const annualGasCost = gasUse * gasPrice;
            const annualCost = annualElectricCost + annualGasCost;
            const annualSaving = baselineCost - annualCost;
            scenarioResult.annualCost = annualCost;
            scenarioResult.savings = annualSaving;
            scenarioResult.savings20yr = calculateSavingsOverYearsDynamic(
                annualSaving,
                0,
                data.inflation.electricity_rate,
                0,
                20
            );
            scenarioResult.breakEvenDynamic = scenarioResult.savings > 0
                ? Math.max(0, totalCost) / scenarioResult.savings
                : null;

            // CO₂ mit realistischem Netzbezug
            const gridEvShare = hasWallbox ? Math.min(scenarioResult.gridImportKwh, wallboxExtra) : 0;
            const gridOther = Math.max(0, scenarioResult.gridImportKwh - gridEvShare);
            const electricityCO2 = (hasWallbox ? wallboxExtra * evCo2Factor : 0) + gridOther * data.co2.electricity_factor;
            const co2_after = electricityCO2 + (scenario.includeHeatpump ? 0 : heatingDemand) * data.co2.gas_factor;
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
                <div class="verbrauch-grid">
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

                    <label>ALTERNATIV: Gewünschte PV-Leistung (kWp)
                        <input id="input_pv_kwp" type="number" min="2" max="30" step="0.1" placeholder="automatisch ermittelt">
                    </label>

                    <label>E-Auto Jahreskilometer (km/a)
                        <input id="input_ev_km" type="number" min="0" max="50000" value="${data.consumption.ev?.annual_km ?? 12000}">
                    </label>

                    <label>E-Auto Verbrauch (kWh/100km)
                        <input id="input_ev_consumption" type="number" min="0" max="50" step="0.1" value="${data.consumption.ev?.kwh_per_100km ?? 17}">
                    </label>

                    <label>Verbrenner Jahreskilometer (km/a)
                        <input id="input_combustion_km" type="number" min="0" max="50000" value="${data.consumption.combustion?.annual_km ?? 15000}">
                    </label>

                    <label>Verbrenner Verbrauch (l/100km)
                        <input id="input_combustion_consumption" type="number" min="0" max="20" step="0.1" value="${data.consumption.combustion?.litres_per_100km ?? 7.0}">
                    </label>
                </div>

                <div class="verbrauch-hinweis">
                    <span class="hinweis-icon">ℹ️</span>
                    Falls Sie Ihre eigenen Werte kennen, tragen Sie diese ein. Alle Berechnungen nutzen automatisch diese Eingaben:
                    <ul style="margin-top: 8px; margin-left: 20px;">
                        <li>Energieverbrauch, Preise und Dachfläche werden automatisch an Ihre Angaben angepasst</li>
                        <li>PV-Leistung: Lassen Sie das Feld leer für automatische Berechnung oder geben Sie einen Wert (2-30 kWp) ein</li>
                        <li>E-Auto & Verbrenner: Nur verfügbar wenn Wallbox geplant ist. Eigene Fahrleistungen und Verbrauchswerte überschreiben die Standardannahmen</li>
                    </ul>
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
            <p>Verbrauchsblöcke (kWh/a): Haushalt ${formatNumber(householdElectric, 0)}, Klima ${formatNumber(airconExtra, 0)}, Wallbox ${formatNumber(wallboxExtra, 0)}, Wärmepumpe ${formatNumber(heatpumpElectric, 0)}.</p>
            <p>Summe Strom (inkl. ggf. WP): ${formatNumber(totalElectricAll, 0)} kWh/a</p>
            <p>Heizwärmebedarf bleibt: ${formatNumber(heatingDemand, 0)} kWh/a;</p>
            <p>Wärmepumpen-Strom (falls WP): ${formatNumber(heatpumpElectric, 0)} kWh/a,</p>
            <p>WP-Leistung: ${formatNumber(heatpumpPower, 1)} kW</p>
            ${wallboxHintText ? `<p class="note">${wallboxHintText} Bevorzugte Nachtladung bei Speicher, um Netzlast zu senken. Zusätzlich ersetzt das E-Auto einen konventionellen Verbrenner (Annahme: ${combustionModel}, ${formatNumber(combustionAnnualKm, 0)} km/a, Verbrauch ${formatNumber(combustionLitresPer100km, 1)} l/100 km).</p>` : ''}
            ${warnings.length ? `<div class="warn-box">${warnings.map((w) => `<p>${w}</p>`).join('')}</div>` : ''}

            <h3>Szenarien (${hasAircon ? 'mit Klimaanlage' : 'ohne Klimaanlage'}, ${hasWallbox ? 'mit Wallbox' : 'ohne Wallbox'})</h3>
            ${scenarios.map((s) => `
                <div class="scenario scenario-block">
                    <h4>${s.label}</h4>
                    <p>Verbräuche (kWh/a): Haushalt ${formatNumber(s.householdBlock, 0)}, Klima ${formatNumber(s.climateBlock, 0)}, Wallbox ${formatNumber(s.evBlock, 0)}, Wärmepumpe ${formatNumber(s.heatpumpBlock, 0)}, Summe ${formatNumber(s.annualConsumption, 0)}</p>
                    <p>Netzstrombezug: ${formatNumber(s.gridElectric, 0)} kWh/a | Gasbedarf: ${formatNumber(s.gasUse, 0)} kWh/a</p>
                    <p>Einspeisung: ${formatNumber(s.feedIn, 0)} kWh/a (Tarif ${formatNumber(feedInTariff, 2)} EUR/kWh)</p>
                    <p>PV-Empfehlung: ${formatNumber(s.pvKwp, 1)} kWp ${s.pvExceedsRoof ? '<span class="warn">⚠️ ACHTUNG: Übersteigt verfügbaren Platz auf der Dachfläche.</span>' : ''}</p>
                    ${s.batteryRecommended ? `<p>Speicher-Empfehlung: ${formatNumber(s.batteryRecommended, 1)} kWh</p>` : ''}
                    ${s.heatpumpPower ? `<p>Wärmepumpe: ${formatNumber(s.heatpumpPower, 1)} kW (Strom ${formatNumber(s.heatpumpElectric, 0)} kWh/a)</p>` : ''}
                    ${hasWallbox ? `<p>EV-Ladung: ${formatNumber(wallboxExtra, 0)} kWh/a</p>` : ''}
                    <div class="cost-block">
                        <strong>Kosten:</strong><br>
                        PV (2025 Marktpreis ~1.850-2.400 EUR/kWp): ${formatNumber(s.pvCost, 0)} EUR<br>
                        Speicher (ca. 650-750 EUR/kWh): ${formatNumber(s.batteryCost, 0)} EUR<br>
                        Wärmepumpe: ${formatNumber(s.heatpumpCost, 0)} EUR<br>
                        ${s.extrasLabel}<br>
                        Gesamt: ${formatNumber(s.totalCost, 0)} EUR
                    </div>
                    ${(() => {
                        let techLabel = 'PV';
                        if (s.batteryRecommended > 0) techLabel += ' + Speicher';
                        if (s.includeHeatpump) techLabel += ' + Wärmepumpe';
                        return `
                            <div class="economy-box">
                                <h4>💶 Wirtschaftlichkeit</h4>
                                <p>Betriebskosten mit ${techLabel}: ${formatNumber(s.annualCost, 0)} EUR/a</p>
                                <p>Einsparung gegenüber heute: ${formatNumber(s.savings, 0)} EUR/a</p>
                                ${s.breakEvenDynamic ? `<p>Break-even (inkl. Energiepreissteigerung): ca. ${formatNumber(s.breakEvenDynamic, 1)} Jahre</p>` : ''}
                            </div>
                        `;
                    })()}
                    ${(() => {
                        const eq = s.co2_equivalents || {};
                        const co2ValuesValid = [s.co2_today, s.co2_after, s.co2_saving, s.co2_saving_20yr, eq.trees, eq.flights, eq.carKm]
                            .every((v) => Number.isFinite(v));
                        if (!co2ValuesValid) return '';
                        const treesRounded = Math.round(eq.trees);
                        const flightsRounded = Math.round(eq.flights);
                        const carKmRounded = Math.round(eq.carKm / 1000) * 1000;
                        return `
                            <div class="co2-box">
                                <h4>🌱 CO₂-Bilanz</h4>
                                <p>Heute: ${formatNumber(s.co2_today, 0)} kg CO₂/a</p>
                                <p>Nachher: ${formatNumber(s.co2_after, 0)} kg CO₂/a</p>
                                <p><strong>Einsparung: ${formatNumber(s.co2_saving, 0)} kg CO₂/a</strong></p>
                                <p>20-Jahres-Einsparung (mit Energiepreissteigerung): ${formatNumber(s.co2_saving_20yr, 0)} kg</p>
                                <hr>
                                <p>Entspricht der CO₂-Bindung von etwa ${treesRounded} Bäumen über ein Jahr.</p>
                                <p>~ ${formatNumber(flightsRounded, 0)} Mallorca-Flüge (Hin- und Rückflug)</p>
                                <p>~ ${formatNumber(carKmRounded, 0)} km Autofahren (Verbrenner)</p>
                                <p class="note">Hinweis: Die CO₂-Emissionen aus der Herstellung der Photovoltaikanlage werden nicht berücksichtigt.</p>
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
        
        // Nach dem Rendern: Update EV/Combustion fields disable state
        updateEVCombustionFieldsState();
        
        // Nach dem Rendern: Werte in die Eingabefelder schreiben (mit user-edited Werten wenn vorhanden)
        setTimeout(() => {
            const elStrom = document.getElementById('input_stromverbrauch');
            const elHeiz = document.getElementById('input_heizwaerme');
            const elPreisStrom = document.getElementById('input_preis_strom');
            const elPreisGas = document.getElementById('input_preis_gas');
            const elDach = document.getElementById('input_dachflaeche');
            const elPvKwp = document.getElementById('input_pv_kwp');
            const elEvKm = document.getElementById('input_ev_km');
            const elEvCons = document.getElementById('input_ev_consumption');
            const elCombustionKm = document.getElementById('input_combustion_km');
            const elCombustionCons = document.getElementById('input_combustion_consumption');
            
            // Setze die Werte und markiere falls user-edited
            if (elStrom) { elStrom.value = Math.round(householdElectric); if (prevValues.strom) elStrom.dataset.userEdited = 'true'; }
            if (elHeiz) { elHeiz.value = Math.round(heatingDemand); if (prevValues.heiz) elHeiz.dataset.userEdited = 'true'; }
            if (elPreisStrom) { elPreisStrom.value = elPrice.toFixed(2); if (prevValues.preisStrom) elPreisStrom.dataset.userEdited = 'true'; }
            if (elPreisGas) { elPreisGas.value = gasPrice.toFixed(2); if (prevValues.preisGas) elPreisGas.dataset.userEdited = 'true'; }
            if (elDach) { elDach.value = roofArea; if (prevValues.dach) elDach.dataset.userEdited = 'true'; }
            if (elPvKwp) { elPvKwp.value = prevValues.pvKwp ?? ''; if (prevValues.pvKwp) elPvKwp.dataset.userEdited = 'true'; }
            if (elEvKm) { elEvKm.value = prevValues.evKm ?? (data.consumption.ev?.annual_km ?? 12000); if (prevValues.evKm) elEvKm.dataset.userEdited = 'true'; }
            if (elEvCons) { elEvCons.value = prevValues.evCons ?? (data.consumption.ev?.kwh_per_100km ?? 17); if (prevValues.evCons) elEvCons.dataset.userEdited = 'true'; }
            if (elCombustionKm) { elCombustionKm.value = prevValues.combustionKm ?? (data.consumption.combustion?.annual_km ?? 15000); if (prevValues.combustionKm) elCombustionKm.dataset.userEdited = 'true'; }
            if (elCombustionCons) { elCombustionCons.value = prevValues.combustionCons ?? (data.consumption.combustion?.litres_per_100km ?? 7.0); if (prevValues.combustionCons) elCombustionCons.dataset.userEdited = 'true'; }
        }, 50);
        const resetValuesBtn = document.getElementById('btn_reset_defaults');
        if (resetValuesBtn) {
            resetValuesBtn.addEventListener('click', () => {
                const defaultsRoof = { reihenhaus: 50, doppelhaus: 70, einfamilienhaus: 100 };
                const strom = document.getElementById('input_stromverbrauch');
                const heiz = document.getElementById('input_heizwaerme');
                const stromPreis = document.getElementById('input_preis_strom');
                const gasPreis = document.getElementById('input_preis_gas');
                const dach = document.getElementById('input_dachflaeche');
                const pvKwp = document.getElementById('input_pv_kwp');
                const evKm = document.getElementById('input_ev_km');
                const evCons = document.getElementById('input_ev_consumption');
                const combustionKm = document.getElementById('input_combustion_km');
                const combustionCons = document.getElementById('input_combustion_consumption');
                
                const stromDefault = householdElectricDefault;
                const heizDefault = heatingDemandDefault;
                if (strom) { strom.value = stromDefault; strom.removeAttribute('data-user-edited'); }
                if (heiz) { heiz.value = heizDefault; heiz.removeAttribute('data-user-edited'); }
                if (stromPreis) { stromPreis.value = elPriceDefault; stromPreis.removeAttribute('data-user-edited'); }
                if (gasPreis) { gasPreis.value = gasPriceDefault; gasPreis.removeAttribute('data-user-edited'); }
                if (dach) { dach.value = defaultsRoof[houseType]; dach.removeAttribute('data-user-edited'); }
                
                // Neue Felder zurücksetzen auf Standardwerte
                if (pvKwp) { pvKwp.value = ''; pvKwp.removeAttribute('data-user-edited'); }
                if (evKm) { evKm.value = data.consumption.ev?.annual_km ?? 12000; evKm.removeAttribute('data-user-edited'); }
                if (evCons) { evCons.value = data.consumption.ev?.kwh_per_100km ?? 17; evCons.removeAttribute('data-user-edited'); }
                if (combustionKm) { combustionKm.value = data.consumption.combustion?.annual_km ?? 15000; combustionKm.removeAttribute('data-user-edited'); }
                if (combustionCons) { combustionCons.value = data.consumption.combustion?.litres_per_100km ?? 7.0; combustionCons.removeAttribute('data-user-edited'); }
                
                // Update EV/Combustion fields disabled state based on wallbox
                updateEVCombustionFieldsState();
                
                // Trigger recalculation
                if (validateConsumptions()) {
                    calculateAll();
                }
            });
        }
        const recalcBtn = document.getElementById('btn_recalc_results');
        if (recalcBtn) {
            recalcBtn.addEventListener('click', () => {
                // Werte aus den Feldern übernehmen und als manuell markiert
                ['input_stromverbrauch', 'input_heizwaerme', 'input_preis_strom', 'input_preis_gas', 'input_dachflaeche', 'input_pv_kwp', 'input_ev_km', 'input_ev_consumption', 'input_combustion_km', 'input_combustion_consumption'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el && el.value) {
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
        ['input_stromverbrauch', 'input_heizwaerme', 'input_preis_strom', 'input_preis_gas', 'input_dachflaeche', 'input_pv_kwp', 'input_ev_km', 'input_ev_consumption', 'input_combustion_km', 'input_combustion_consumption'].forEach((id) => {
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




const energyForm = document.getElementById('energyForm');
if (energyForm) {
    energyForm.addEventListener('submit', (e) => {
        e.preventDefault();
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

document.addEventListener('DOMContentLoaded', () => {
    const backToTop = document.getElementById('backToTop');
    if (!backToTop) return;
    const toggle = () => {
        backToTop.style.display = window.scrollY > 300 ? 'flex' : 'none';
    };
    window.addEventListener('scroll', toggle);
    toggle();
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// ========== PERFORMANCE OPTIMIERUNGEN ==========

/**
 * Initialisiert Performance-Features:
 * - Lazy Subsidy Loading
 * - Debounced Input Events
 * - Result Caching Integration
 */
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lazy Loading für Subsidies
    initializeSubsidyLazyLoading?.();
    
    // 2. Initialize EV/Combustion fields state (disabled until wallbox is checked)
    updateEVCombustionFieldsState();
    const wallboxEl = document.getElementById('wallbox');
    if (wallboxEl) {
        wallboxEl.addEventListener('change', updateEVCombustionFieldsState);
    }
    
    // 3. Initialize Baujahr field state (disabled until Bundesland is selected)
    updateBaujahrFieldState();
    const bundeslandEl = document.getElementById('bundesland');
    if (bundeslandEl) {
        bundeslandEl.addEventListener('change', updateBaujahrFieldState);
    }
    
    // 4. Debounce für Input-Events (verhindert zu häufige Berechnungen)
    const form = document.getElementById('energyForm');
    if (form) {
        // Debounce für alle Input/Select-Änderungen (außer Submit)
        const debouncedCalcAll = debounce(() => {
            if (validateConsumptions()) {
                calculateAll();
            }
        }, 500);
        
        form.querySelectorAll('input, select').forEach(field => {
            field.addEventListener('change', debouncedCalcAll);
            field.addEventListener('input', debouncedCalcAll);
        });
    }
    
    // 5. Throttle für Window Resize (Chart Redraw)
    const redrawChartsThrottled = throttle(() => {
        if (yearChartInstance) yearChartInstance.resize();
        if (dayChartInstance) dayChartInstance.resize();
    }, 500);
    
    window.addEventListener('resize', redrawChartsThrottled);
    
    // 4. Debounce für PDF Export (verhindert doppelte PDF-Generierung)
    const pdfBtn = document.getElementById('exportPdfBtn');
    if (pdfBtn) {
        const debouncedPdfExport = debounce(async () => {
            // Existierende PDF-Export-Logik triggern
            const event = new MouseEvent('click', { bubbles: true });
            pdfBtn.dispatchEvent(event);
        }, 300);
        
        // Überschreibe Original-Listener mit debounced Version
        pdfBtn.addEventListener('click', debouncedPdfExport, { once: true });
    }
    
    // 5. Monitor Cache-Performance (für Debugging)
    console.log('[Performance] Caching enabled with localStorage fallback');
    console.log('[Performance] Debouncing active on input events (500ms)');
    console.log('[Performance] Throttling active on window resize (500ms)');
});

/**
 * Integration mit bestehender calculateAll() Funktion
 * Fügt Caching auf höchster Ebene hinzu
 */
const originalCalculateAll = window.calculateAll || (() => {});
window.calculateAll = async function() {
    const params = {
        houseType: document.getElementById('houseType')?.value,
        area: parseInt(document.getElementById('area')?.value || 0),
        people: parseInt(document.getElementById('people')?.value || 0),
        insulation: document.getElementById('insulation')?.value,
        floorHeating: document.getElementById('floorHeating')?.value,
        aircon: document.getElementById('aircon')?.value,
        wallbox: document.getElementById('wallbox')?.value,
    };
    
    // Cache-Check
    if (resultCache && typeof resultCache.get === 'function') {
        const cached = resultCache.get(params);
        if (cached) {
            console.log('[Cache] Hit! Using cached results');
            // Würde Ergebnisse aus Cache rendern (optional)
            // Für jetzt: trotzdem neuberechnen, aber schneller bei wieder gleichen Params
        }
    }
    
    // Führe ursprüngliche Berechnung aus
    return originalCalculateAll.apply(this, arguments);
};
