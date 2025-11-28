// Grundlegende Daten laden
async function loadData() {
    const response = await fetch('data/data.json');
    return await response.json();
}

// Hauptberechnung
async function calculate() {
    const data = await loadData();

    const houseType = document.getElementById('houseType').value;
    const area = parseFloat(document.getElementById('area').value);
    const people = parseInt(document.getElementById('people').value);
    const insulation = document.getElementById('insulation').value;
    const floorHeating = document.getElementById('floorHeating').value;
    const aircon = document.getElementById('aircon').value;
    const bundesland = document.getElementById('bundesland').value;

    // --- Verbrauchswerte aus JSON ---
    const basePerSqm = data.consumption.base_per_sqm[houseType];
    const perPerson = data.consumption.per_person;

    let consumption = area * basePerSqm + people * perPerson;

    // --- Isolierungsfaktor ---
    const insulationFactor = data.insulation_factors[insulation];
    consumption *= insulationFactor;

    // --- Klimaanlage ---
    if (aircon === 'ja') {
        consumption += data.aircon.extra_kwh;
    }

    // --- Wärmepumpe Berechnung ---
    const wp = data.heatpump;
    const cop = floorHeating === 'ja' ? wp.cop_with_floor : wp.cop_without_floor;
    const wp_power = (consumption * wp.heating_share) / cop;

    // --- PV-Bedarf ---
    const pv = data.pv;
    const required_kWp = consumption / pv.yield_per_kwp;

    // --- Kostenabschätzung ---
    const cost_pv = required_kWp * pv.cost_per_kwp;
    const cost_hp = wp_power * wp.cost_per_kw;

    const total_cost = cost_pv + cost_hp;

    // --- Anzeige ---
    document.getElementById('result').innerHTML = `
        <h2>Ergebnis</h2>
        <p><strong>Geschätzter Jahresverbrauch:</strong> ${consumption.toFixed(0)} kWh</p>
        <p><strong>Benötigte PV-Leistung:</strong> ${required_kWp.toFixed(1)} kWp</p>
        <p><strong>Wärmepumpen-Leistung:</strong> ${wp_power.toFixed(1)} kW</p>
        <p><strong>Kosten PV:</strong> ca. ${cost_pv.toFixed(0)} €</p>
        <p><strong>Kosten Wärmepumpe:</strong> ca. ${cost_hp.toFixed(0)} €</p>
        <p><strong>Gesamtkosten:</strong> ca. ${total_cost.toFixed(0)} €</p>
    `;
}

document.getElementById('calcBtn').addEventListener('click', calculate);
