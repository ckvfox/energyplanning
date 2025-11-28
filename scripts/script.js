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

async function calculateAll() {
    const resultEl = document.getElementById('result');
    try {
        const data = await loadData();

        // Eingaben
        const houseType = document.getElementById('houseType').value;
        const area = Number(document.getElementById('area').value);
        const people = Number(document.getElementById('people').value);
        const insulation = document.getElementById('insulation').value;
        const hasAircon = document.getElementById('aircon').value === 'ja';
        const hasFloorHeating = document.getElementById('floorHeating').value === 'ja';
        const hasWallbox = document.getElementById('wallbox')?.value === 'ja';

        if (!area || !people) {
            resultEl.innerHTML = '<p>Bitte alle Pflichtfelder ausfuellen.</p>';
            return;
        }

        // Haushaltsstrom
        const householdElectric = people * data.consumption.per_person;
        const airconExtra = hasAircon ? data.consumption.aircon_extra : 0;
        const wallboxExtra = hasWallbox ? (data.consumption.wallbox_extra || 0) : 0;

        // Heizwaermebedarf
        const heatingPerSqm = data.consumption.heating_per_sqm[houseType];
        const insulationFactor = data.insulation_factors[insulation] ?? 1;
        const heatingDemand = area * heatingPerSqm * insulationFactor;

        // Waermepumpenstrom und Leistung
        const cop = hasFloorHeating ? data.heatpump.cop_floor : data.heatpump.cop_no_floor;
        const heatpumpElectric = heatingDemand / cop;
        const heatpumpPower = heatingDemand / data.heatpump.full_load_hours;

        // Basisstrom ohne WP
        const baseElectric = householdElectric + airconExtra + wallboxExtra;

        const scenarios = [
            { label: 'Nur Photovoltaik', includeBattery: false, includeHeatpump: false },
            { label: 'PV + Speicher', includeBattery: true, includeHeatpump: false },
            { label: 'PV + Speicher + Waermepumpe', includeBattery: true, includeHeatpump: true }
        ].map((scenario) => {
            const annualConsumption = baseElectric + (scenario.includeHeatpump ? heatpumpElectric : 0);
            const pvKwp = (0.7 * annualConsumption) / data.pv.yield_per_kwp;

            const dailyUse = annualConsumption / 365;
            const nightLoad = dailyUse * 0.5;
            const batteryMin = nightLoad * data.battery.recommended_factor_min;
            const batteryMax = nightLoad * data.battery.recommended_factor_max;
            const batteryRecommended = scenario.includeBattery ? clamp((batteryMin + batteryMax) / 2, 8, 12) : 0;

            const pvCost = pvKwp * data.pv.cost_per_kwp;
            const batteryCost = batteryRecommended * data.battery.cost_per_kwh;
            const heatpumpCost = scenario.includeHeatpump ? heatpumpPower * data.heatpump.cost_per_kw : 0;
            const totalCost = pvCost + batteryCost + heatpumpCost;

            return {
                label: scenario.label,
                annualConsumption,
                pvKwp,
                batteryRecommended,
                heatpumpPower: scenario.includeHeatpump ? heatpumpPower : 0,
                heatpumpElectric: scenario.includeHeatpump ? heatpumpElectric : 0,
                pvCost,
                batteryCost,
                heatpumpCost,
                totalCost
            };
        });

        resultEl.innerHTML = `
            <h2>Ergebnis</h2>
            <h3>Unterstellte Verbraeuche</h3>
            <p>Haushalt: ${formatNumber(householdElectric, 0)} kWh/a${hasAircon ? `, Klimaanlage: +${formatNumber(airconExtra, 0)} kWh/a` : ''}${hasWallbox ? `, Wallbox: +${formatNumber(wallboxExtra, 0)} kWh/a` : ''}</p>
            <p>Heizwaermebedarf: ${formatNumber(heatingDemand, 0)} kWh/a (Daemmfaktor ${formatNumber(insulationFactor, 2)})</p>
            <p>Waermepumpen-Strom (falls WP): ${formatNumber(heatpumpElectric, 0)} kWh/a, WP-Leistung: ${formatNumber(heatpumpPower, 1)} kW</p>

            <h3>Szenarien (${hasAircon ? 'mit Klimaanlage' : 'ohne Klimaanlage'}, ${hasWallbox ? 'mit Wallbox' : 'ohne Wallbox'})</h3>
            ${scenarios.map((s) => `
                <div class="scenario">
                    <h4>${s.label}</h4>
                    <p>Gesamtstrombedarf: ${formatNumber(s.annualConsumption, 0)} kWh/a</p>
                    <p>PV-Empfehlung: ${formatNumber(s.pvKwp, 1)} kWp</p>
                    <p>Speicher-Empfehlung: ${s.batteryRecommended ? formatNumber(s.batteryRecommended, 1) + ' kWh' : 'kein Speicher'}</p>
                    <p>Waermepumpe: ${s.heatpumpPower ? `${formatNumber(s.heatpumpPower, 1)} kW (Strom ${formatNumber(s.heatpumpElectric, 0)} kWh/a)` : 'keine WP'}</p>
                    <p>Kosten: PV ${formatNumber(s.pvCost, 0)} €, Speicher ${formatNumber(s.batteryCost, 0)} €, Waermepumpe ${formatNumber(s.heatpumpCost, 0)} €, Gesamt ${formatNumber(s.totalCost, 0)} €</p>
                </div>
            `).join('')}
        `;
    } catch (err) {
        resultEl.innerHTML = `<p>Fehler: ${err.message}</p>`;
    }
}

document.getElementById('calcBtn').addEventListener('click', calculateAll);
