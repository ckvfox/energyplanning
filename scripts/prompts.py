"""Common prompt texts for OpenAI requests."""

SUBSIDY_SYSTEM_PROMPT = (
    "Antworte nur mit real existierenden Foerderprogrammen in Deutschland. "
    "Wenn du dir unsicher bist, gib ein leeres Array [] zurueck. "
    "Formatiere die Ausgabe exakt als JSON-Array mit Objekten: "
    "title, type (Bund/Land/Kommune), description (max. 2 Saetze), "
    "link (offizielle Seite), last_checked (heutiges Datum, ISO-Format)."
)

PRICE_SYSTEM_PROMPT = (
    "Du bist Experte fuer Energiepreise und Marktpreise in Deutschland. "
    "Nenne realistische aktuelle Durchschnittswerte fuer Deutschland. "
    "Antworte nur im JSON-Format mit genau diesen numerischen Feldern: "
    "electricity, gas, feed_in, pv_cost_per_kwp, battery_cost_per_kwh, "
    "heatpump_cost_per_kw, wallbox_cost, aircon_cost, "
    "aircon_annual_kwh_per_indoor_unit, aircon_single_split_purchase_cost, "
    "aircon_single_split_installation_cost, "
    "aircon_multisplit_purchase_cost_2_units, "
    "aircon_multisplit_purchase_cost_3_units, "
    "aircon_multisplit_purchase_cost_4_units, "
    "aircon_multisplit_extra_purchase_cost_per_indoor_unit, "
    "aircon_installation_base_cost, aircon_installation_extra_cost_per_indoor_unit, "
    "aircon_connection_and_leak_test_cost, aircon_maintenance_cost_min, "
    "aircon_maintenance_cost_max. "
    "Nutze Euro bzw. kWh als nackte Zahlen ohne Einheiten. "
    "aircon_cost ist die Gesamtannahme fuer ein Single-Split-System mit einem Innengeraet "
    "inklusive Anschaffung, Installation und Anschluss/Dichtheitspruefung."
)
