# Energetische Modernisierungs-Rechner (Web-App)

Ein leichter, lokaler Web-Rechner zur ersten Orientierung fuer Strom- und Waermeverbrauch, PV- und Speicher-Dimensionierung, Waermepumpe, Kosten- und Break-even-Schaetzung sowie einfache Foerderhinweise.

## Features
- Verbrauchsabschaetzung nach Haustyp, Flaeche, Personen, Daemmzustand
- Szenarien: PV, PV+Speicher, PV+Speicher+Waermepumpe (mit Klima/Wallbox je Auswahl)
- Kostenmodelle inkl. Einspeiseannahme, Break-even-Schaetzung
- Optionale Foerderhinweise je Bundesland (statische Aussagen + subsidies.json)
- Vollstaendig clientseitig, keine Server- oder Tracking-Calls

## Projektstruktur
- `index.html` – UI, Intro, Formulareingaben, Ergebnisbereiche
- `style.css` – Styling, responsive Layout
- `scripts/script.js` – Berechnungen, Szenarien, Foerderanzeige
- `data/data.json` – Verbrauchs- und Kostenannahmen
- `data/subsidies.json` – Foerderprogramme (pro Bundesland/Kategorie)
- `scripts/fetch_subsidies.py` – OpenAI-basierter Updater fuer subsidies.json
- `.github/workflows/fetch_subsidies.yml` – Woechentlicher/Manueller Update-Job

## Nutzung (lokal)
```bash
python -m http.server 8000
# Dann http://localhost:8000 im Browser oeffnen
```
Alle Berechnungen laufen im Browser, kein Backend noetig.

## Foerderdaten aktualisieren
```bash
pip install --upgrade openai httpx python-dotenv
OPENAI_API_KEY=dein-key python scripts/fetch_subsidies.py
```
Das Skript liest `.env` automatisch, wenn vorhanden. Ergebnis wird in `data/subsidies.json` gespeichert. Bei Parsing-Problemen werden betroffene Kategorien geleert und Warnungen ausgegeben.

## GitHub Workflow
- Manuell und sonntags 03:00 UTC (`.github/workflows/fetch_subsidies.yml`)
- Benoetigt Secret `OPENAI_API_KEY`
- Commit/push von `data/subsidies.json` bei Aenderungen

## Annahmen / Kosten
- Strompreis: 0,35 EUR/kWh, Gaspreis: 0,12 EUR/kWh, Einspeiseverguetung: 0,08 EUR/kWh (siehe `data/data.json`)
- PV: Mindestgroesse 4 kWp, Zieldeckung 75 % des Verbrauchs
- Speicher: Empfehlung basierend auf Nachtlast (Clamp 6–14 kWh)
- Waermepumpe: COP je nach Fussbodenheizung, Leistung aus Heizwaerme / Vollbenutzungsstunden

## Bekannte Hinweise
- Browser-Konsole-Fehler aus `content_script.js` stammen von Extensions, nicht vom Projekt.
- Foerderdaten koennen unvollstaendig sein; leere Kategorien bedeuten, dass keine sicheren Programme geliefert wurden.

## Lizenz
MIT License
