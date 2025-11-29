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

function calculateBreakEvenDynamic(investCost, annualSaving, inflationRate) {
    let sum = 0;
    let years = 0;
    while (sum < investCost && years < 40) {
        const adjustedSaving = annualSaving * Math.pow(1 + inflationRate, years);
        sum += adjustedSaving;
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
                            <a href="${item.link_portal}" target="_blank" rel="noopener noreferrer">Zum Foerderportal</a>
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
        const airconUnitCost = data.costs?.aircon_cost ?? data.aircon?.cost_per_unit ?? 0;
        const wallboxUnitCost = data.costs?.wallbox_cost ?? data.wallbox?.cost_per_unit ?? 0;
        const airconCost = hasAircon ? airconUnitCost : 0;
        const wallboxCost = hasWallbox ? wallboxUnitCost : 0;

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

        const co2Today = calculateCO2Today(householdElectric, heatingDemand, data);

        // Drei Szenarien
        const scenarios = [
            { label: 'Nur Photovoltaik', includeBattery: false, includeHeatpump: false },
            { label: 'PV + Speicher', includeBattery: true, includeHeatpump: false },
            { label: 'PV + Speicher + Waermepumpe', includeBattery: true, includeHeatpump: true }
        ].map((scenario) => {
            const includesAircon = hasAircon;
            const includesWallbox = hasWallbox;
            const annualConsumption = modernBaseElectric + (scenario.includeHeatpump ? heatpumpElectric : 0);
            const gasUse = scenario.includeHeatpump ? 0 : heatingDemand;

            // PV sizing mit 75 % Zielabdeckung, Mindestgroesse 4 kWp
            const includePv = true;
            let coverageFactor = 0.75;
            if (includePv && scenario.includeBattery && !scenario.includeHeatpump) {
                coverageFactor = 1.0;
            }
            if (includePv && scenario.includeBattery && scenario.includeHeatpump) {
                coverageFactor = 1.1;
            }

            let pvKwp = (coverageFactor * annualConsumption) / data.pv.yield_per_kwp;
            if (includePv && scenario.includeBattery && !scenario.includeHeatpump) {
                pvKwp = Math.max(pvKwp, 5);
            }
            if (includePv && scenario.includeBattery && scenario.includeHeatpump) {
                pvKwp = Math.max(pvKwp, 8);
            }
            pvKwp = Math.max(4, pvKwp);
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
            const breakEvenInvestment = Math.max(0, totalCost - extrasCost);
            const breakEvenDynamic = savings > 0
                ? calculateBreakEvenDynamic(breakEvenInvestment, savings, data.price_inflation_rate)
                : null;

            // CO₂ nachher: nur Netzstrombezug zählt, nicht Gesamtstrom
            const gridImport = gridElectric;
            const gasNew = scenario.includeHeatpump ? 0 : heatingDemand;
            const co2_after = calculateCO2After(gridImport, gasNew, scenario, data);
            const co2_saving = co2Today - co2_after;
            const co2_saving_20yr = calculateCO2SavingsOverYears(co2_saving, data.price_inflation_rate, 20);
            const equivalents = calculateCO2Equivalents(co2_saving_20yr, data);

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
                gridImportKwh: gridImport,
                savings,
                breakEvenDynamic,
                includesAircon,
                includesWallbox,
                co2_today: co2Today,
                co2_after,
                co2_saving,
                co2_saving_20yr,
                co2_equivalents: equivalents
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
                    <p>Betriebskosten mit PV/WP: ${formatNumber(s.annualCost, 0)} EUR/a | Einsparung ggue. heute: ${formatNumber(s.savings, 0)} EUR/a${s.breakEvenDynamic ? ` | Break-even (mit Energiepreissteigerung): ca. ${formatNumber(s.breakEvenDynamic, 1)} Jahre` : ''}</p>
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
