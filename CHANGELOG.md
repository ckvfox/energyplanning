# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [1.3.1] – 2026-06-16

### Added
- 🤖 Serverseitige Bot-Erkennung in `.htaccess` via `BrowserMatchNoCase`: Googlebot, Bingbot, DuckDuckBot, YandexBot, Baiduspider, AhrefsBot, SemrushBot, WAVE, Lighthouse und weitere Crawler/Accessibility-Tools werden erkannt
- 📄 `index-static.html`: Script-freie, vorgerenderte HTML-Seite als Crawl-Target; enthält Formular, statische Beispielergebnisse für alle drei Szenarien und statische Förderprogramm-Übersicht
- ↔️ `Vary: User-Agent`-Header für HTML-Responses, damit Proxies und CDNs Bot- und Nutzer-Antworten getrennt cachen
- 🔍 `robots.txt`: `Allow: /index-static.html` und expliziter Eintrag für WAVE Accessibility Tool ergänzt

### Changed
- 🔒 Webserver-Sicherheitsheader in `.htaccess` auf Härtungsprofil aktualisiert:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` mit restriktiveren Richtlinien (u.a. `frame-ancestors 'none'`, JSON-LD-Hashes, ohne `unsafe-inline` für Styles)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - erweiterte `Permissions-Policy` mit deaktivierten Browser-Features
- 🔍 Crawler-Erkennung in `.htaccess` um `webcheck-bot` erweitert, damit lokale Webcheck-Audits denselben statischen HTML-Snapshot wie anerkannte Bots erhalten können

### Fixed
- 🐛 GitHub CI: Dependency-Installation im Workflow auf `pip install -r requirements.txt` umgestellt (vermeidet Shell-Probleme mit `>=` in Paketangaben)

### Technical
- 🔧 GitHub Actions: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` gesetzt, um Node-20-Deprecation-Warnungen proaktiv abzufangen

## [1.3.0] – 2026-06-13

### Added
- ♿ Umfassende Accessibility-Verbesserungen:
  - Korrekte `<label for="">` Bindungen für alle Formularfelder
  - `<fieldset>` & `<legend>` semantische Struktur
  - ARIA-Attribute: `aria-required`, `aria-describedby`, `aria-live`, `aria-selected`, `aria-pressed`
  - Keyboard-Navigation: Tab, Shift+Tab, Arrow-Keys, Home/End in Tablist
  - Focus-Styling mit 3px Box-Shadow für alle interaktiven Elemente
  - Screenreader-Text mit `.visually-hidden` Klasse
  - Hilfs-Text (`.hint-text`) für optionale Formularfelder
- 🎨 `.scenario-buttons` Container mit Flex-Wrapping
- ⌨️ Keyboard-Shortcuts für Szenario-Auswahl und Tag/Nacht-Toggle

### Technical
- 🔧 Form Submit statt Button Click für bessere Semantik
- 🔧 Formular-Validierung über `required` Attribute
- 🔧 ARIA tablist/tab Rollen für Szenario-Buttons
- 🔧 ARIA pressed/selected State-Handling in Keyboard-Events

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

