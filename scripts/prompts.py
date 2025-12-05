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
    "Nenne realistische Durchschnittswerte fuer das Jahr 2025 fuer: "
    "- Haushaltsstrompreis (€/kWh) "
    "- Gaspreis (€/kWh) "
    "- Einspeiseverguetung fuer PV (€/kWh) "
    "- Installationspreis PV pro kWp (€/kWp) "
    "- Speicherpreise pro kWh (€/kWh) "
    "- Waermepumpen-Installationskosten pro kW (€/kW) "
    "- Wallbox inkl.Installation (Pauschalpreis) "
    "- Split-Klimaanlage inkl. Installation (Pauschalpreis) "
    "Antworte nur im JSON-Format."
)
