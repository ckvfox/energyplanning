# Energetische Modernisierungs-Rechner

> 🏠 Ein leichter, kostenlos nutzbarer Web-Rechner zur **ersten Orientierung** für Strom- und Wärmeverbrauch, PV- und Speicher-Dimensionierung, Wärmepumpen-Auslegung sowie Kosten- und Break-even-Schätzung.

**Live-Demo:** [https://example.com](https://example.com)  
**GitHub:** [ckvfox/energyplanning](https://github.com/ckvfox/energyplanning)

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
- 💬 [Discussions](https://github.com/ckvfox/energyplanning/discussions)
- 🔐 [Security Issues](SECURITY.md)

---

**Zuletzt aktualisiert**: 2025-12-04  
**Version**: 1.2.0
