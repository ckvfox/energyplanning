# Energetische Modernisierungs-Rechner

> 🏠 Ein leichter, kostenlos nutzbarer Web-Rechner zur **ersten Orientierung** für Strom- und Wärmeverbrauch, PV- und Speicher-Dimensionierung, Wärmepumpen-Auslegung sowie Kosten- und Break-even-Schätzung.

**GitHub:** [ckvfox/energyplanning](https://github.com/ckvfox/energyplanning)  
**Version:** 1.4.2

### ♿ Accessibility Status
✅ **WCAG 2.1 Level AA** – Vollständig tastaturgesteuert, Screenreader-kompatibel, optimierte Farbkontraste

📖 **Dokumentation:** Siehe [ACCESSIBILITY.md](ACCESSIBILITY.md)

---

## 🌟 Features

### 📊 Berechnungen
- 🔋 **Verbrauchsabschätzung** nach Haustyp, Fläche, Personen, Dämmzustand
- 🏘️ **3 Grundszenarien**: Nur PV, PV + Speicher, PV + Speicher + Wärmepumpe; gewählte Extras werden im Chart mitgeführt
- ⚡ **Optionale Zusatzlasten**: Multisplit-Klimaanlage nach Anzahl Innengeräte, Wallbox (E-Auto)
- 💰 **Kostenmodelle** inkl. Einspeisevergütung, Break-even-Berechnung
- 🎯 **PV-Sizing**: Verbrauchs- und Dachheuristik; Details und Abweichungen zur Ertragsannahme siehe Berechnungsdokumentation
- 💾 **Speicher-Dimensionierung**: 0,9 × täglicher Verbrauch, 4–15 kWh Clamp
- 📊 **Szenarien-Vergleich** mit Autarkie-, Kosten- & CO₂-Visualisierung
- 🌱 **CO₂-Einsparung** in Bäumen, Flügen, Autofahrten (20 Jahre)

### 🌐 Benutzerführung
- 🗺️ **Förderhinweise** je Bundesland (KfW, BAFA, Länder)
- 📄 **PDF-Export** der Ergebnisse
- 🌍 **Vollständig clientseitig** – Keine Server-Calls, keine Datenerhebung
- 📱 **Responsive** – Desktop, Tablet, Mobile (4 Breakpoints)
- ⌨️ **Tastaturgesteuert** – Arrow Keys, Tab, Enter – Alle Funktionen ohne Maus
- 🔍 **SEO-optimiert** – Meta-Tags, JSON-LD structured data, robots.txt

### ⚡ Performance & UX
- 🚀 **Result Caching** – localStorage + Memory Cache
- ⏱️ **Input Debouncing** – Reduziert Berechnungen von 50/s auf 1-2/s
- 💨 **Lazy Loading** – Förderdaten nur bei Bedarf
- 📦 **Kompakt** – 2.5 MB Gesamtgröße, ~1.5s Initial Load

### 🧪 Qualität
- ✅ **Automatisierte Prüfungen** – Energieerhaltung, Konfigurationsabgleich, DOM-Integration, Preisübernahmesperre und Service Worker
- 📚 **Umfassende Dokumentation** – Architecture, Calculations, Deployment, Accessibility
- 🔐 **Sichere Code-Basis** – No XSS, no external APIs (außer für Subsidies-Update)

---

## 🚀 Quick Start

### Lokal starten (Python)
```bash
git clone https://github.com/ckvfox/energyplanning.git
cd energyplanning
python -m http.server 8000
```
Dann öffnen: **http://localhost:8000**

### Tests ausführen
```bash
npm ci --ignore-scripts
npm test
python scripts/check_calculation_docs.py
python -m unittest discover -s scripts -p "test_fetch*.py"
```
Node.js 18 oder neuer; Python-Abhängigkeiten gemäß `requirements.txt`
(CI: Python 3.11). `npm test` prüft die echten Browser-Skripte in einer
DOM-Testumgebung, ersetzt jedoch keine visuelle Browserabnahme.

---

## 📁 Projektstruktur

```
energyplanning/
├── index.html                          ← UI & Formular
├── style.css                           ← Vollständiges Styling (Responsive)
├── scripts/
│   ├── script.js                       ← Berechnungen & Orchestration
│   ├── calculation-core.js             ← Reine Kernberechnungen
│   ├── chart-ui.js                     ← Chart.js-Darstellung
│   ├── pdf-export.js                   ← Browser-PDF-/Druckexport
│   ├── performance.js                  ← Caching, Lazy Loading & Offline-Fallback
│   ├── subsidy-ui.js                   ← Sichere DOM-Ausgabe der Förderprogramme
│   ├── tests.js                        ← Unit Test Framework (NEU)
│   ├── fetch_subsidies.py              ← Förderdaten-Updater
│   └── prompts.py                      ← Prompt-Templates
├── data/
│   ├── data.json                       ← Verbrauchs- & Kostenannahmen + Colors
│   ├── subsidies.json                  ← Förderprogramme (lazy loaded)
├── images/                             ← Logo, Icons
├── docs/                               ← Dokumentation (NEU)
│   ├── ARCHITECTURE.md                 ← System Design & Data Flow
│   ├── CALCULATIONS.md                 ← Alle Formeln & Algorithmen
│   └── DEPLOYMENT.md                   ← Installation & Server-Setup
├── datenschutz.html & impressum.html   ← Legal Pages
├── CHANGELOG.md                        ← Version History
├── CONTRIBUTING.md                     ← Developer Guidelines
├── SECURITY.md                         ← Security Policy
└── LICENSE                             ← MIT License
```

---

## ⚙️ Modell und Berechnungsgrundlagen

Die verbindliche Beschreibung der implementierten Formeln, der konfigurierten
Modellwerte und ihrer Grenzen steht in [docs/CALCULATIONS.md](docs/CALCULATIONS.md).
`data/data.json` enthält editierbare Annahmen, keine zugesicherten Marktpreise.
Fest codierte Heuristiken stehen zusätzlich in `scripts/script.js` und
`scripts/calculation-core.js`; insbesondere sind Dimensionierung und Ertrag
unterschiedliche Berechnungsschritte.

Konsistenzprüfung: `python scripts/check_calculation_docs.py` und
`npm test`.
Nach fachlicher Prüfung geänderter Annahmen die Tabelle und den Prüfstand mit
`python scripts/check_calculation_docs.py --write` aktualisieren. Der Befehl
bestätigt keine fachliche Richtigkeit und ersetzt keine Prüfung der Formeln.

---

## 🔒 Datenschutz & Sicherheit

- ✅ **Keine Datenerhebung** – Vollständig clientseitig
- ✅ **Keine Cookies** – localStorage nur für Caching (user-specific)
- ✅ **Open Source** – Transparente Quellcode
- ✅ **XSS-Schutz** – `textContent` statt `innerHTML`
- ✅ **GDPR-konform** – Keine Übertragung persönlicher Daten

Siehe [SECURITY.md](SECURITY.md)

---

## ♿ Barrierefreiheit

- ✅ **WCAG 2.1 Level AA** – Vollständig konform
- ✅ **Keyboard Navigation** – Tab, Arrow Keys, Enter, Escape
- ✅ **Screenreader Support** – ARIA labels, proper semantic HTML
- ✅ **Focus Indicators** – 3px Blue Box-Shadow
- ✅ **Responsive** – Legbar auf allen Zoomleveln
- ✅ **Color Contrast** – 4.5:1 für normalen Text

Siehe [ACCESSIBILITY.md](ACCESSIBILITY.md)

---

## 📈 Performance Metriken

Die produktive Seite wird regelmäßig durch das zentrale Webcheck-Projekt
geprüft. Die dortigen PageSpeed-/Lighthouse-Werte sind die maßgebliche,
zeitgestempelte Quelle; die folgende Tabelle ist nur ein dokumentierter
Referenzstand.

| Metrik | Wert | Status |
|--------|------|--------|
| Initial Load | 1,5s | ✓ |
| First Interaction | 300ms | ✓ |
| Berechnung (first) | 50-200ms | ✓ |
| Berechnung (cached) | 1ms | ✓ |
| PDF Export | 2-3s | ✓ |
| Lighthouse Score | 94 | ✓ |

**Cache Hit Rate:** ~65% typisch

---

## 🛠️ Development & Deployment

Tests: siehe Quick Start und [Berechnungsgrundlagen](docs/CALCULATIONS.md).

### Cache-Performance monitoring
```javascript
console.log('Cache size:', resultCache.getSize());
```

### Deployment zu GitHub Pages
```bash
git push origin main  # Auto-deployed via GitHub Pages
```

Siehe [DEPLOYMENT.md](docs/DEPLOYMENT.md) für alle Deployment-Optionen.

Ein minifizierter Upload-Payload wird mit den gepinnten Werkzeugen aus
`requirements-dev.txt` und `scripts/build_deployment.py` in einen neuen Ordner
außerhalb des Repositories gebaut. Der Build startet kein Deployment. Full und Delta in den bestehenden FTP-Ordnern werden gemeinsam mit `python scripts/build_deployment.py --base-ref <Commit-vor-dem-Aenderungssatz>` erneuert. Der Vergleichsstand muss den gesamten auszuliefernden Aenderungssatz abdecken; siehe docs/DEPLOYMENT.md.

---

## 🤝 Mitarbeit

Contributions sind willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md):
- Bug Reports
- Feature Requests
- Pull Requests

---

## 📝 Lizenz

[MIT License](LICENSE) – Frei nutzbar & weiterverwendbar

---

## 🙏 Danksagungen

- **Chart.js** – Datenvisualisierung
- **html2pdf** – PDF-Export
- **PVGIS** – PV-Ertragsdaten
- Alle Contributors & Community

---

## ⚠️ Hinweise zur Nutzung

Diese Anwendung bietet **orientierende Berechnungen** für die erste Planungsphase:
- ❌ **Keine** verbindliche Beratung
- ❌ **Keine** Gewährleistung der Genauigkeit
- ✅ Für lokale Szenarien mit Fachperson validieren
- ✅ Förderungshinweise sind unverbindlich, immer bei Behörden abfragen

---

## 📞 Support

- 📖 [Dokumentation](docs/)
- 🐛 [Issues](https://github.com/ckvfox/energyplanning/issues)
- 🔐 [Security Issues](SECURITY.md)

---

**Zuletzt aktualisiert**: 2025-12-04  
**Version**: 1.4.2

## Strukturharmonisierung und Bestandsschutz

Dieses Bestandsprojekt ist eine statische, clientseitige Webanwendung mit Daten- und Fetch-Skripten. Die produktiven Pfade `index.html`, `style.css`, `scripts/`, `data/` und `images/` bleiben bestehen, weil sie direkt von Seite, GitHub Pages/Hosting und Dokumentation referenziert werden.

FPF-Zielstandard fuer neue Projekte:

- neue Web-/PHP-Projekte bevorzugen `assets/css`, `assets/js` und `assets/img`
- datengetriebene statische Projekte duerfen `data/`, `scripts/` und `images/` verwenden, wenn dies dokumentiert ist
- lokale Fetcher und Tests bleiben unter `scripts/`; produktive Browser-Skripte muessen ausdruecklich dokumentiert sein
- bestehende Deployment-Pakete unter `builds/full-deployment/` und `builds/delta-deployment/` werden nicht ohne separaten Migrationsplan verschoben

Die Berechnungsgrundlagen werden ausschließlich in docs/CALCULATIONS.md gepflegt.
