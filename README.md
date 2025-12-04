# Energetische Modernisierungs-Rechner

> 🏠 Ein leichter, kostenlos nutzbarer Web-Rechner zur **ersten Orientierung** für Strom- und Wärmeverbrauch, PV- und Speicher-Dimensionierung, Wärmepumpen-Auslegung sowie Kosten- und Break-even-Schätzung.

**Live-Demo:** [https://example.com](https://example.com)  
**GitHub:** [ckvfox/energyplanning](https://github.com/ckvfox/energyplanning)  
**Version:** 1.3.0

### ♿ Accessibility Status
✅ **WCAG 2.1 Level AA** – Vollständig tastaturgesteuert, Screenreader-kompatibel, optimierte Farbkontraste

📖 **Dokumentation:** Siehe [ACCESSIBILITY.md](ACCESSIBILITY.md)

---

## 🌟 Features

### 📊 Berechnungen
- 🔋 **Verbrauchsabschätzung** nach Haustyp, Fläche, Personen, Dämmzustand
- 🏘️ **3 Szenarien**: Nur PV, PV + Speicher, PV + Speicher + Wärmepumpe
- ⚡ **Optionale Zusatzlasten**: Klimaanlage, Wallbox (E-Auto)
- 💰 **Kostenmodelle** inkl. Einspeisevergütung, Break-even-Berechnung
- 🎯 **PV-Sizing**: 850 kWh/kWp, intelligente Limits nach Dachfläche & Haustyp
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
- ✅ **16 Unit Tests** – Energy Balance, Costs, Utilities, Caching, Debouncing
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

### Tests ausführen (Browser-Konsole)
```javascript
// Alle Unit Tests
runAllTests();
```

---

## 📁 Projektstruktur

```
energyplanning/
├── index.html                          ← UI & Formular
├── style.css                           ← Vollständiges Styling (Responsive)
├── scripts/
│   ├── script.js                       ← Berechnungen & Orchestration
│   ├── performance.js                  ← Caching, Debouncing, Lazy Loading (NEU)
│   ├── tests.js                        ← Unit Test Framework (NEU)
│   ├── fetch_subsidies.py              ← Förderdaten-Updater
│   └── prompts.py                      ← Prompt-Templates
├── data/
│   ├── data.json                       ← Verbrauchs- & Kostenannahmen + Colors
│   ├── subsidies.json                  ← Förderprogramme (lazy loaded)
│   └── tmp/                            ← Temporäre Dateien
├── images/                             ← Logo, Icons
├── docs/                               ← Dokumentation (NEU)
│   ├── ARCHITECTURE.md                 ← System Design & Data Flow
│   ├── CALCULATIONS.md                 ← Alle Formeln & Algorithmen
│   └── DEPLOYMENT.md                   ← Installation & Server-Setup
├── datenschutz.html & impressum.html   ← Legal Pages
├── CHANGELOG.md                        ← Version History (v1.3.0)
├── CONTRIBUTING.md                     ← Developer Guidelines
├── SECURITY.md                         ← Security Policy
└── LICENSE                             ← MIT License
```

---

## ⚙️ Konfiguration

### data.json – Zentrale Konfiguration
```json
{
  "assumptions": {
    "pvYieldPerKwp": 850,
    "batteryRoundtripEff": 0.85,
    "gridPrice": 0.35,
    "feedInPrice": 0.08
  },
  "colors": {
    "pv": "#fbc02d",
    "consumption": "#1976d2",
    "selfConsumption": "#388e3c"
  }
}
```

---

## 📊 Berechnungsgrundlagen

### PV-Sizing
- **Formel**: `Jahresstromverbrauch / 850 kWh/kWp`
- **Dachfläche-Limit**: `floor(roofArea / 7)` kWp
- **Haustyp-Limits**: Reihenhaus ≤14 kWp, Doppelhaus ≤18 kWp, EFH ≤24 kWp

### Speicher-Dimensionierung
- **Empfehlung**: `täglicher Verbrauch × 0.9`
- **Grenzen**: Clamp(4, 15) kWh

### Energiebilanz
```
PV_Generation = pvKwp × 850
directSelf = min(load × 0.35, pvGen × 0.9)
batteryDelivered = pvSurplus × 0.85  // Mit 85% Wirkungsgrad
selfUse = min(load, directSelf + batteryDelivered)
autarky = (selfUse / load) × 100  [%]
```

Siehe [CALCULATIONS.md](docs/CALCULATIONS.md) für komplette Mathematik.

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

### Tests ausführen
```javascript
// In Browser-Konsole:
runAllTests();

// Output: ✅ 16 Tests passed
```

### Cache-Performance monitoring
```javascript
console.log('Cache size:', resultCache.getSize());
```

### Deployment zu GitHub Pages
```bash
git push origin main  # Auto-deployed via GitHub Pages
```

Siehe [DEPLOYMENT.md](docs/DEPLOYMENT.md) für alle Deployment-Optionen.

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

## 🌟 Features

- 🔋 **Verbrauchsabschätzung** nach Haustyp, Fläche, Personen, Dämmzustand
- 🏘️ **3 Szenarien**: 
  - Nur Photovoltaik
  - PV + Speicher
  - PV + Speicher + Wärmepumpe
- ⚡ **Optionale Zusatzlasten**: Klimaanlage, Wallbox (E-Auto)
- 💰 **Kostenmodelle** inkl. Einspeisevergütung, Break-even-Berechnung
- 🎯 **Moderne PV-Sizing**: 850 kWh/kWp, intelligente Limits
- 💾 **Speicher-Dimensionierung**: 0,9 × täglicher Verbrauch
- 📊 **Szenarien-Vergleich** mit Autarkie-, Kosten- & CO₂-Visualisierung
- 🌱 **CO₂-Einsparung** in Bäumen, Flügen, Autofahrten
- 🗺️ **Förderhinweise** je Bundesland (aus `data/subsidies.json`)
- 📄 **PDF-Export** der Ergebnisse
- 🌐 **Vollständig clientseitig** – Keine Server-Calls, keine Datenerhebung
- 🌍 **Responsive** – Desktop, Tablet, Mobile
- ⌨️ **Tastaturgesteuert** – Alle Funktionen ohne Maus nutzbar
- 🔍 **SEO-optimiert** – Meta-Tags, JSON-LD structured data, robots.txt

---

## 🚀 Quick Start

### Lokal starten (Python)
```bash
git clone https://github.com/ckvfox/energyplanning.git
cd energyplanning
python -m http.server 8000
```
Dann öffnen: **http://localhost:8000**

### Mit Node.js
```bash
npx http-server
```

Oder einfach die `index.html` direkt im Browser öffnen (eingeschränkte Funktionalität).

---

## 📁 Projektstruktur

```
energyplanning/
├── index.html              ← UI & Formular
├── style.css               ← Vollständiges Styling
├── scripts/
│   ├── script.js           ← Berechnungen & Logik
│   ├── fetch_subsidies.py  ← Förderdaten-Updater (OpenAI-basiert)
│   ├── modernisierung_tests.py  ← Unit Tests
│   └── prompts.py          ← Prompt-Templates für OpenAI
├── data/
│   ├── data.json           ← Verbrauchs- & Kostenannahmen
│   ├── subsidies.json      ← Förderprogramme (automatisch aktualisiert)
│   └── tmp/                ← Temporäre Dateien (Updater)
├── images/                 ← Logo, Icons
├── datenschutz.html        ← Privacy Policy
├── impressum.html          ← Legal Notice
├── docs/                   ← Dokumentation
├── tests/                  ← Unit Tests
├── .github/
│   └── workflows/
│       └── fetch_subsidies.yml  ← Wöchentlicher Update-Job
├── CHANGELOG.md            ← Version History
├── CONTRIBUTING.md         ← Contributor Guide
├── SECURITY.md             ← Security Policy
└── LICENSE                 ← MIT License
```

---

## ⚙️ Konfiguration

### data.json – Verbrauchsannahmen
```json
{
  "consumption": {
    "per_person": 1000,
    "aircon_extra": 450,
    "wallbox_extra": 1800,
    "ev": {
      "model": "VW ID.4",
      "annual_km": 15000,
      "kwh_per_100km": 17
    },
    "combustion": {
      "model": "VW Passat 1.5 TSI",
      "litres_per_100km": 7.0,
      "co2_per_litre": 2.3
    }
  },
  "pv": {
    "yield_per_kwp": 950,
    "cost_per_kwp": 1600
  },
  "battery": {
    "cost_per_kwh": 550
  }
}
```

### Förderdaten aktualisieren
```bash
# .env mit OPENAI_API_KEY
OPENAI_API_KEY=sk-... python scripts/fetch_subsidies.py
```

Oder automatisch via GitHub Actions (`.github/workflows/fetch_subsidies.yml`)

---

## 📊 Berechnungsgrundlagen

### PV-Sizing
- **Grundlogik**: `Jahresstromverbrauch / 850 kWh/kWp`
- **Mindestgröße**: 7 kWp bei Speicher oder Wärmepumpe
- **Dachfläche-Limit**: 6 m² pro kWp (moderne Module)
- **Haustyp-Limits**: Reihenhaus 14 kWp, Doppelhaus 18 kWp, EFH 24 kWp

### Speicher-Dimensionierung
- **Empfehlung**: 0,9 × täglicher Stromverbrauch
- **Clamp**: 4–15 kWh

### Wärmepumpe
- **COP-Berechnung**: Basis 3,0, Faktoren je Dämmung & Fußbodenheizung
- **Leistung**: Heizwärmebedarf / 2.000 Vollbenutzungsstunden

### Break-even-Analyse
- Dynamische Amortisationsrechnung mit Energiepreissteigerung
- Standardannahmen: Strom +2 %/a, Gas +3 %/a

---

## 🔒 Datenschutz & Sicherheit

- ✅ **Keine Datenerhebung** – Vollständig clientseitig
- ✅ **Keine Cookies** – Außer technisch notwendigen
- ✅ **Open Source** – Quellcode transparent auf GitHub
- ✅ **GDPR-konform** – Keine Übertragung persönlicher Daten

Siehe [SECURITY.md](SECURITY.md) & [datenschutz.html](datenschutz.html)

---

## ♿ Barrierefreiheit

- ✅ WCAG 2.1 Level AA angestrebt
- ✅ Keyboard-Navigation
- ✅ ARIA-Labels für Screenreader
- ✅ Responsive Design für Zoombarkeit

---

## 📈 Performance

- 📦 < 100 KB (Gzipped)
- ⚡ Keine External APIs (außer OpenAI-Updater)
- 🎯 ~50ms Szenarien-Berechnung
- 📊 Chart.js für Visualisierung

---

## 🛠️ Development

### Setup
```bash
git clone https://github.com/ckvfox/energyplanning.git
cd energyplanning
python -m http.server 8000
```

### Tests ausführen
```bash
python scripts/modernisierung_tests.py
```

### Code Audit
Siehe [AUDIT_AND_IMPROVEMENTS.md](AUDIT_AND_IMPROVEMENTS.md)

### Style Guide
- JavaScript: camelCase, Funktionen 20-40 Zeilen
- CSS: kebab-case, Mobile-First
- JSON: 2-Space, kommentierbar via `// dummy`

---

## 🤝 Mitarbeit

Contributions sind willkommen! Bitte siehe [CONTRIBUTING.md](CONTRIBUTING.md) für:
- Branch-Strategie
- Code-Style
- Pull-Request Prozess
- Issue-Reporting

---

## 📝 Lizenz

[MIT License](LICENSE) – Frei nutzbar & weiterverwendbar

---

## 🙏 Danksagungen

- **Chart.js** – Datenvisualisierung
- **html2pdf** – PDF-Export
- **OpenAI API** – Förderdaten-Aggregation
- Alle Contributors & Feedback-Geber

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
**Version**: 1.3.0
