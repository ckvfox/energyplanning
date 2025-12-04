# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [1.2.0] – 2025-12-04

### Added
- ✨ Dynamisches Wirtschaftlichkeits-Block für alle Szenarien
- ✨ Verbrenner-Daten aus `data.json` statt hardcodiert
- ✨ PDF-Export mit überarbeiteter Seitentrennung
- 📄 Umfassende Audit- & Improvement-Dokumentation
- 📄 CONTRIBUTING.md, SECURITY.md, .editorconfig
- 📄 robots.txt und .well-known/security.txt

### Changed
- 🔄 PV-Sizing: 850er Divisor, neue Limits (Reihenhaus 14, EFH 24 kWp)
- 🔄 Speicher-Sizing: 0,9 × täglicher Verbrauch, Clamp 4–15 kWh
- 🔄 Dachflächenberechnung: /6 statt /7 (modernere Module)
- 🔄 PDF-Container: Optimierte Struktur, schlankeres Layout
- 🔄 Text-Bereinigung: CO₂-Formulierungen einheitlich, keine Redundanzen
- 🔄 `.economy-box` Styling einheitlich mit `.co2-box`

### Fixed
- 🐛 data.json: Korrigierte JSON-Struktur (fehlende Kommas)
- 🐛 PDF-Export: Null-Canvas Error-Handling
- 🐛 Chart.js Resize mit Try-Catch geschützt

### Technical
- 🔧 PV: Mindestgröße 7 kWp bei Speicher/WP
- 🔧 Verbrenner-Logik auf data.consumption.combustion migriert
- 🔧 Script.js: Error-Handling für Chart-Rendering

### Docs
- 📖 README.md: Wird aktualisiert mit v1.2.0-Details
- 📖 AUDIT_AND_IMPROVEMENTS.md: Detaillierte Analyse & Recommendations

---

## [1.1.0] – 2025-11-20

### Added
- ✨ Szenarien-Block mit dynamischen Beschriftungen
- ✨ CO₂-Bilanz mit Bäumen-Äquivalent
- ✨ Autarkie-Visualisierung mit Progress-Bars

### Changed
- 🔄 Preise aktualisiert: PV 1.600 EUR/kWp, Speicher 550 EUR/kWh
- 🔄 Layout: Bessere Seitentrennung im PDF

### Fixed
- 🐛 Speicher-Empfehlung bei keiner WP

---

## [1.0.0] – 2025-11-01

### Initial Release
- ✨ Web-Rechner für energetische Modernisierung
- ✨ Verbrauchsabschätzung nach Haustyp
- ✨ Szenarien: PV, PV+Speicher, PV+Speicher+Wärmepumpe
- ✨ Kosten- & Break-even-Berechnung
- ✨ Förderprogramm-Anzeige
- ✨ PDF-Export

---

## Format

Dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

- **MAJOR**: Inkompatible Änderungen (z.B. API-Breaking)
- **MINOR**: Neue Features, rückwärts-kompatibel
- **PATCH**: Bugfixes, interne Verbesserungen

### Kategorien

- ✨ **Added** – Neue Features
- 🔄 **Changed** – Verhaltensänderungen
- 🐛 **Fixed** – Bugfixes
- ⚠️ **Deprecated** – Künftig entfernt
- 🗑️ **Removed** – Entfernt
- 🔧 **Technical** – Technische Änderungen
- 📖 **Docs** – Dokumentation

