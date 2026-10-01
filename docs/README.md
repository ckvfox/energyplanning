# Dokumentation

Dieser Ordner enthaelt technische Zusatzdokumentation zur statischen Energieplanungs-Anwendung.

## Aktuelle Dokumente

- `ARCHITECTURE.md`: Systemdesign und Datenfluss.
- `CALCULATIONS.md`: Formeln und Berechnungslogik.
- `DEPLOYMENT.md`: Installation und Deployment-Hinweise.
- `ROLLBACK_REFACTORING.md`: Hinweise fuer Ruecknahme groesserer Aenderungen.

## Updater: fehlende Responses API (GitHub Actions und lokal)

Symptom: `'OpenAI' object has no attribute 'responses'`, anschliessend Exit-Code 1.
Ursache: `openai==1.30.0` enthielt die von beiden Fetch-Skripten verwendete Schnittstelle nicht;
eine Pruefung nur auf die Hauptversion 1 konnte das nicht erkennen.
Abhilfe: `python -m pip install -r requirements.txt` in einer funktionsfaehigen Python-Umgebung
ausfuehren. Der SDK-Pin ist auf 1.109.1 angehoben. Beide Einstiegspunkte pruefen die
Responses-Schnittstelle vor dem Datenzugriff. CI testet echte SDK-Aufrufe mit simulierten
HTTP-Antworten: `python -m unittest discover -s scripts -p "test_fetch*.py"`.
Dieser Offline-Test prueft weder API-Berechtigungen noch Modellverfuegbarkeit.
Bei SDK-Aenderungen immer die verwendete Schnittstelle testen, nicht nur Versionsnummern.

## Strukturhinweis

Die produktive Bestandsstruktur nutzt Root-Dateien, `scripts/`, `data/` und `images/`. Diese Pfade werden nicht ohne separaten Migrationsplan nach `assets/` oder `build/deployment/` verschoben.
