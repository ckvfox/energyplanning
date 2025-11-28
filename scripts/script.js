async function loadData() {
    const response = await fetch('data/data.json');
    if (!response.ok) {
        throw new Error('Daten konnten nicht geladen werden');
    }
    return response.json();
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

async function loadSubsidies() {
    try {
        const res = await fetch('data/subsidies.json');
        if (!res.ok) {
            return {};
        }
        return await res.json();
    } catch (e) {
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
        'Photovoltaik wird bundesweit ueber 0 % MwSt beguenstigt, derzeit gibt es keine direkten Zuschuesse.',
        'Batteriespeicher werden bundesweit derzeit nicht gefoerdert. Kommunale Programme sind moeglich.'
    ];

    if (userSelections.heatpump) {
        if (!Number.isNaN(houseAge) && houseAge < 2024) {
            baseMessages.push('Waermepumpen sind ueber die BEG foerderfaehig, 30-70 % Zuschuss je nach Austausch und Einkommen.');
        } else {
            baseMessages.push('Waermepumpen im Neubau sind nicht foerderfaehig.');
        }
    }

    baseMessages.push('Heizungsoptimierung inklusive hydraulischem Abgleich ist mit ca. 15 % foerderfaehig.');
    baseMessages.push('Daemmung, Fenster, Tueren sind als Effizienzmassnahmen mit ca. 15-20 % foerderfaehig.');

    let stateHtml = '';
    if (statePrograms) {
        const categories = [
            { key: 'pv', label: 'PV' },
            { key: 'battery', label: 'Batteriespeicher' },
            { key: 'heatpump', label: 'Waermepumpe' },
            { key: 'heating_optimization', label: 'Heizungsoptimierung' },
            { key: 'building_envelope', label: 'Gebaeudehuelle' }
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
                            <a href="${item.link}" target="_blank" rel="noopener noreferrer">Zum Programm</a>
                        </div>
                    `);
                });
            }
        });

        if (entries.length > 0) {
            stateHtml = entries.join('');
        } else {
            stateHtml = `<p>Fuer ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.</p>`;
        }
    } else {
        stateHtml = `<p>Fuer ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.</p>`;
    }

    return { baseMessages, stateHtml };
}

// Zeigt die Foerderprogramme an, basierend auf Bundesland und Hausalter
async function showSubsidies(houseAgeValue, bundesland) {
    const box = document.getElementById('subsidyBox');
    const content = document.getElementById('subsidyContent');
    if (!box || !content) return;

    if (!bundesland) {
        box.style.display = 'none';
        content.innerHTML = '';
        return;
    }

    // Relevante Massnahmen: PV und Speicher immer, Waermepumpe vorhanden, Optimierung und Huelle immer sinnvoll
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
        content.innerHTML = '<p>Foerderdaten nicht verfuegbar.</p>';
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
        : `<p>Fuer dieses Bundesland sind derzeit keine spezifischen Programme hinterlegt. Pruefe zusaetzlich die Webseite deiner Landesbank oder Kommune.</p>`;

    content.innerHTML = staticHtml + dynamicHtml;
    box.style.display = 'block';
}

async function calculateAll() {
    const resultEl = document.getElementById('result');
    try {
        const data = await loadData();

        // Eingaben aus dem Formular
        const houseType = document.getElementById('houseType').value;
        const area = Number(document.getElementById('area').value);
        const people = Number(document.getElementById('people').value);
        const insulation = document.getElementById('insulation').value;
        const houseAgeValue = parseInt(document.getElementById('houseAge')?.value, 10);
        const bundesland = document.getElementById('bundesland')?.value || '';
        const hasAircon = document.getElementById('aircon').value === 'ja';
        const hasFloorHeating = document.getElementById('floorHeating').value === 'ja';
        const hasWallbox = document.getElementById('wallbox')?.value === 'ja';
        const elPrice = data.prices.electricity_eur_per_kwh;
        const gasPrice = data.prices.gas_eur_per_kwh;
        const feedInTariff = data.prices.feed_in_eur_per_kwh;
        const airconCost = hasAircon ? data.aircon?.cost_per_unit || 0 : 0;
        const wallboxCost = hasWallbox ? data.wallbox?.cost_per_unit || 0 : 0;

        if (!area || !people) {
            resultEl.innerHTML = '<p>Bitte alle Pflichtfelder ausfuellen.</p>';
            return;
        }

        // Haushaltsstrom (Status quo: ohne Zusatzlasten)
        const householdElectric = people * data.consumption.per_person;
        const airconExtra = hasAircon ? data.consumption.aircon_extra : 0;
        const wallboxExtra = hasWallbox ? data.consumption.wallbox_extra : 0;

        // Heizwaermebedarf (Daemmung bereits enthalten)
        const heatingPerSqm = data.consumption.heating_per_sqm[houseType]?.[insulation] ?? 0;
        const heatingDemand = area * heatingPerSqm;

        // Waermepumpenstrom und Leistung
        const cop = hasFloorHeating ? data.heatpump.cop_floor : data.heatpump.cop_no_floor;
        const heatpumpElectric = heatingDemand / cop;
        const heatpumpPower = heatingDemand / data.heatpump.full_load_hours;

        // Status-quo-Verbrauch (ohne Klima/Wallbox/WP)
        const baselineElectric = householdElectric;
        const baselineGas = heatingDemand;
        const baselineCost = baselineElectric * elPrice + baselineGas * gasPrice;

        // Modernisierungs-Verbrauch (mit optionalen Zusatzlasten)
        const modernBaseElectric = householdElectric + airconExtra + wallboxExtra;

        // Drei Szenarien
        const scenarios = [
            { label: 'Nur Photovoltaik', includeBattery: false, includeHeatpump: false },
            { label: 'PV + Speicher', includeBattery: true, includeHeatpump: false },
            { label: 'PV + Speicher + Waermepumpe', includeBattery: true, includeHeatpump: true }
        ].map((scenario) => {
            const annualConsumption = modernBaseElectric + (scenario.includeHeatpump ? heatpumpElectric : 0);
            const gasUse = scenario.includeHeatpump ? 0 : heatingDemand;

            // PV sizing mit 75 % Zielabdeckung, Mindestgroesse 4 kWp
            const pvKwpRaw = (0.75 * annualConsumption) / data.pv.yield_per_kwp;
            const pvKwp = Math.max(4, pvKwpRaw);
            const pvGeneration = pvKwp * data.pv.yield_per_kwp;

            // Speicher sizing (6-14 kWh Clamp)
            const dailyUse = annualConsumption / 365;
            const nightLoad = dailyUse * 0.5;
            const batteryMin = nightLoad * data.battery.recommended_factor_min;
            const batteryMax = nightLoad * data.battery.recommended_factor_max;
            const batteryRecommended = scenario.includeBattery
                ? clamp((batteryMin + batteryMax) / 2, 6, 14)
                : 0;

            // Kosten
            const pvCost = pvKwp * data.pv.cost_per_kwp;
            const batteryCost = batteryRecommended * data.battery.cost_per_kwh;
            const heatpumpCost = scenario.includeHeatpump ? heatpumpPower * data.heatpump.cost_per_kw : 0;
            const extrasCost = airconCost + wallboxCost;
            const totalCost = pvCost + batteryCost + heatpumpCost + extrasCost;

            const extrasLabel = hasAircon || hasWallbox
                ? `${hasAircon ? `Klimaanlage ${formatNumber(airconCost, 0)} EUR` : ''}${hasAircon && hasWallbox ? ', ' : ''}${hasWallbox ? `Wallbox ${formatNumber(wallboxCost, 0)} EUR` : ''}`
                : 'Klimaanlage/Wallbox nicht ausgewaehlt';

            // Betriebskosten (mit PV, Einspeiseverguetung)
            const selfUse = Math.min(annualConsumption, pvGeneration * 0.7);
            const feedIn = Math.max(pvGeneration - selfUse, 0);
            const gridElectric = Math.max(annualConsumption - selfUse, 0);
            const annualCost = gridElectric * elPrice + gasUse * gasPrice - feedIn * feedInTariff;
            const savings = baselineCost - annualCost;
            const paybackYears = savings > 0 ? totalCost / savings : null;

            return {
                label: scenario.label,
                annualConsumption,
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
                annualCost,
                feedIn,
                gridElectric,
                savings,
                paybackYears
            };
        });

        // Ausgabe
        let baseHtml = `
            <h2>Ergebnis</h2>
            <h3>Unterstellte Verbraeuche (Status quo)</h3>
            <p>Haushalt: ${formatNumber(householdElectric, 0)} kWh/a</p>
            <p>Heizwaermebedarf: ${formatNumber(heatingDemand, 0)} kWh/a (Daemmzustand bereits eingerechnet)</p>
            <p>Heutige jaehrliche Energiekosten (Strom ${formatNumber(elPrice, 2)} EUR/kWh, Gas ${formatNumber(gasPrice, 2)} EUR/kWh): ${formatNumber(baselineCost, 0)} EUR/a</p>

            <h3>Annahmen nach Modernisierung</h3>
            <p>Haushalt (inkl. ggf. Klima/Wallbox): ${formatNumber(modernBaseElectric, 0)} kWh/a${hasAircon ? `, davon Klima +${formatNumber(airconExtra, 0)} kWh/a` : ''}${hasWallbox ? `, Wallbox +${formatNumber(wallboxExtra, 0)} kWh/a` : ''}</p>
            <p>Heizwaermebedarf bleibt: ${formatNumber(heatingDemand, 0)} kWh/a; Waermepumpen-Strom (falls WP): ${formatNumber(heatpumpElectric, 0)} kWh/a, WP-Leistung: ${formatNumber(heatpumpPower, 1)} kW</p>

            <h3>Szenarien (${hasAircon ? 'mit Klimaanlage' : 'ohne Klimaanlage'}, ${hasWallbox ? 'mit Wallbox' : 'ohne Wallbox'})</h3>
            ${scenarios.map((s) => `
                <div class="scenario">
                    <h4>${s.label}</h4>
                    <p>Gesamtstrombedarf: ${formatNumber(s.annualConsumption, 0)} kWh/a</p>
                    <p>Netzstrombezug: ${formatNumber(s.gridElectric, 0)} kWh/a, Gasbedarf: ${formatNumber(s.gasUse, 0)} kWh/a, Einspeisung: ${formatNumber(s.feedIn, 0)} kWh/a (Tarif ${formatNumber(feedInTariff, 2)} EUR/kWh)</p>
                    <p>PV-Empfehlung: ${formatNumber(s.pvKwp, 1)} kWp</p>
                    <p>Speicher-Empfehlung: ${s.batteryRecommended ? formatNumber(s.batteryRecommended, 1) + ' kWh' : 'kein Speicher'}</p>
                    <p>Waermepumpe: ${s.heatpumpPower ? `${formatNumber(s.heatpumpPower, 1)} kW (Strom ${formatNumber(s.heatpumpElectric, 0)} kWh/a)` : 'keine WP'}</p>
                    <p>Kosten: PV (2025 Marktpreis ~1.850-2.400 EUR/kWp) ${formatNumber(s.pvCost, 0)} EUR, Speicher (ca. 650-750 EUR/kWh) ${formatNumber(s.batteryCost, 0)} EUR, Waermepumpe ${formatNumber(s.heatpumpCost, 0)} EUR, ${s.extrasLabel}, Gesamt ${formatNumber(s.totalCost, 0)} EUR</p>
                    <p>Betriebskosten mit PV/WP: ${formatNumber(s.annualCost, 0)} EUR/a | Einsparung ggue. heute: ${formatNumber(s.savings, 0)} EUR/a${s.paybackYears ? ` | Break-even: ca. ${formatNumber(s.paybackYears, 1)} Jahre` : ''}</p>
                </div>
            `).join('')}
            <div class="notice-box">
                <strong>⚠️ Hinweis: Elektro / Zaehler­schrank</strong>
                <p>Bei vielen Bestandsgebaeuden kann der Zaehler­schrank angepasst werden muessen. Puffer: 1.500–3.000 EUR zusaetzlich.</p>
            </div>
        `;

        resultEl.innerHTML = baseHtml;
        await showSubsidies(houseAgeValue, bundesland);
    } catch (err) {
        resultEl.innerHTML = `<p>Fehler: ${err.message}</p>`;
    }
}

document.getElementById('calcBtn').addEventListener('click', calculateAll);

const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        const houseTypeSelect = document.getElementById('houseType');
        if (houseTypeSelect) houseTypeSelect.value = 'reihenhaus';
        document.getElementById('area').value = '100';
        document.getElementById('people').value = '2';
        const houseAge = document.getElementById('houseAge');
        if (houseAge) houseAge.value = '';
        document.getElementById('insulation').value = 'normal';
        document.getElementById('floorHeating').value = 'nein';
        document.getElementById('aircon').value = 'nein';
        const wallbox = document.getElementById('wallbox');
        if (wallbox) wallbox.value = 'nein';
        const bundesland = document.getElementById('bundesland');
        if (bundesland) bundesland.value = '';
        document.getElementById('result').innerHTML = '';
    });
}
