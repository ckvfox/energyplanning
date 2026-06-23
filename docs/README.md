# Dokumentation

Dieser Ordner enthaelt technische Zusatzdokumentation zur statischen Energieplanungs-Anwendung.

## Aktuelle Dokumente

- `ARCHITECTURE.md`: Systemdesign und Datenfluss.
- `CALCULATIONS.md`: Formeln und Berechnungslogik.
- `DEPLOYMENT.md`: Installation und Deployment-Hinweise.
- `ROLLBACK_REFACTORING.md`: Hinweise fuer Ruecknahme groesserer Aenderungen.

## Strukturhinweis

Die produktive Bestandsstruktur nutzt Root-Dateien, `scripts/`, `data/` und `images/`. Diese Pfade werden nicht ohne separaten Migrationsplan nach `assets/` oder `build/deployment/` verschoben.
