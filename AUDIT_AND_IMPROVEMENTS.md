# Code Audit & Improvement Recommendations

## 1. CODE STRUCTURE & ORGANIZATION

### ✅ **Gut gelöst:**
- Klare Datei-Aufteilung (HTML, CSS, JS, JSON)
- Konfigurationen in `data/data.json` ausgelagert
- Keine Backend-Dependencies, vollständig clientseitig

### ⚠️ **Code außerhalb seiner Dateien:**

#### CSS in HTML (index.html, Zeilen 8-24)
**Problem:** Inline `<style>` Block für PDF-Regeln
```html
<style>
  .pdf-pagebreak { page-break-before: always; }
  /* ... */
</style>
```
**Lösung:** 
- Auslagern in `style.css` (neue Sektion `/* PDF-Export Styles */`)
- Oder in separate `pdf.css`

#### Inline-Styles in script.js (ab Zeile 514)
**Problem:** Zahlreiche `cssText` Definitionen im JavaScript
```javascript
pdfContainer.style.cssText = 'width: 800px; margin: 0; padding: 20px; ...';
```
**Besser:** PDF-Klassen definieren und per Class zuweisen
```javascript
pdfContainer.classList.add('pdf-container');
```

#### Hardcodierte Farben in script.js (Zeilen 366-369, 412-415)
**Problem:** Chart-Farben direkt im Code
```javascript
{ label: 'PV', data: ..., borderColor: '#fbc02d', borderWidth: 2 }
```
**Lösung:** In `data/data.json` unter neuem `"colors"` Block

### 📊 **Verbesserung der Datenstruktur:**

Folgende Werte sollten aus data.json kommen:
```json
{
  "colors": {
    "pv": "#fbc02d",
    "consumption": "#1976d2",
    "selfConsumption": "#388e3c",
    "gridImport": "#d32f2f"
  },
  "pdf": {
    "title": "Energetische Modernisierung – Ergebnisbericht",
    "pageSize": "a4",
    "margin": [15, 15, 15, 15],
    "fontSize": 12
  },
  "ui": {
    "dateFormat": "de-DE",
    "language": "de"
  }
}
```

---

## 2. PERFORMANCE IMPROVEMENTS

### 🐌 **Aktuelle Bottlenecks:**

1. **Chart.js Resize in PDF-Export (Zeile 594)**
   - Mehrfaches `.resize()` verursacht DOM-Reflows
   - Sollte in `requestAnimationFrame` ausgeführt werden

2. **Szenario-Berechnungen (Zeile 1074+)**
   - 3 Szenarien × komplexe Funktionen = redundante Berechnungen
   - Keine Caching/Memoization

3. **DOM-Klone im PDF-Export**
   - `cloneNode(true)` ist teuer für große DOM-Bäume
   - Besser: Nur notwendige Elemente serialisieren

### 📈 **Optimierungsvorschläge:**

```javascript
// Memoization für Energiebalance
const energyBalanceCache = new Map();
function getEnergyBalance(key, ...params) {
  if (!energyBalanceCache.has(key)) {
    energyBalanceCache.set(key, estimateEnergyBalance(...params));
  }
  return energyBalanceCache.get(key);
}

// Debounce für Input-Events
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Lazy-load Charts nur bei Bedarf
const chartsInitialized = false;
document.getElementById('scenario-switch').addEventListener('click', () => {
  if (!chartsInitialized) {
    initializeCharts();
  }
});
```

---

## 3. SECURITY & XSS PREVENTION

### ⚠️ **Potenzielle Sicherheitslücken:**

1. **innerHTML mit Benutzereingaben (Zeilen 1320+)**
   - HTML-Eingaben könnten XSS-Vektoren sein
   ```javascript
   // UNSICHER:
   resultsWrapper.innerHTML = `<h2>Ergebnisse</h2>`;
   resultsWrapper.appendChild(resultsClone);
   ```

2. **fetch() ohne CORS-Handling**
   - `fetch(dataUrl)` bei relativen Paths kann fehlschlagen

### ✅ **Empfohlene Fixes:**

```javascript
// Sanitize HTML
function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

// Oder nutze textContent statt innerHTML
element.textContent = userValue;

// CORS-robuster
const getJsonUrl = (path) => {
  try {
    return new URL(path, document.baseURI).toString();
  } catch {
    return path;
  }
};
```

---

## 4. ACCESSIBILITY (a11y)

### ❌ **Probleme:**

1. **Fehlende Labels für Form-Inputs (index.html, Zeile 50+)**
   ```html
   <!-- FALSCH: -->
   <label>Haustyp
       <select id="housetype" ...>...</select>
   </label>
   
   <!-- RICHTIG: -->
   <label for="housetype">Haustyp:</label>
   <select id="housetype" ...>...</select>
   ```

2. **Chart-Container ohne Alt-Text (Zeile 760+)**
   ```javascript
   // Fehlende: role="img", aria-label
   <canvas id="yearChart"></canvas>
   ```

3. **Keine Keyboard-Navigation für Buttons**

4. **Fehlende ARIA-Live-Regions** für dynamische Ergebnisse

### ✅ **Fixes:**

```html
<!-- Charts mit Beschreibung -->
<div role="img" aria-label="Jährliche Energiebilanz: PV-Erzeugung, Verbrauch, Eigenverbrauch, Netzbezug">
  <canvas id="yearChart"></canvas>
</div>

<!-- Scenario-Switch mit Live-Region -->
<div id="results" role="region" aria-live="polite" aria-label="Berechnungsergebnisse">
  ...
</div>

<!-- Bessere Label -->
<fieldset>
  <legend>Gebäudeeingaben</legend>
  <label for="housetype">Haustyp:</label>
  <select id="housetype" aria-describedby="housetype-help">...</select>
  <small id="housetype-help">Wählen Sie Ihren Gebäudetyp aus</small>
</fieldset>
```

---

## 5. SEO IMPROVEMENTS

### ⚠️ **Defizite:**

1. **Fehlende Meta-Tags**
2. **Keine Structured Data (JSON-LD)**
3. **Keine Open Graph Tags für Social Sharing**
4. **Keine Sitemap oder robots.txt**

### ✅ **Empfohlene Ergänzungen in index.html:**

```html
<meta name="description" content="Kostenloser Online-Rechner für energetische Modernisierung: PV-Dimensionierung, Speicher, Wärmepumpe, Break-even-Analyse.">
<meta name="keywords" content="Photovoltaik, Energiespeicher, Wärmepumpe, Modernisierung, Kosten, Förderung">
<meta property="og:title" content="Energetische Modernisierung – Kostenkalkulation">
<meta property="og:description" content="Berechnen Sie Ihre Investitionskosten und Amortisation für PV, Speicher und Wärmepumpe.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com">

<!-- JSON-LD Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Energetische Modernisierung Rechner",
  "description": "Kalkulator für PV, Speicher, Wärmepumpen",
  "applicationCategory": "UtilityApplication",
  "url": "https://example.com"
}
</script>
```

Zusätzlich erstellen:
- `robots.txt` – Crawl-Regeln
- `sitemap.xml` – Falls mehrere Seiten geplant
- `.well-known/security.txt` – Für Security Researchers

---

## 6. MISSING PROJECT FILES

### Fehlende Standard-Projektdateien:

✅ **Vorhanden:**
- LICENSE
- README.md
- .gitignore
- .github/workflows/

❌ **Fehlen:**
1. **CONTRIBUTING.md** – Richtlinien für Contributors
2. **.editorconfig** – Konsistent Editorkonfiguration
3. **package.json** – Für npm Dependencies (falls hinzugefügt)
4. **.env.example** – Template für Umgebungsvariablen
5. **CHANGELOG.md** – Versions-Historie
6. **robots.txt** – SEO/Crawling
7. **security.txt** – Responsible Disclosure
8. **.gitattributes** – Line-Endings vereinheitlichen

### Weitere Verbesserungen:
```
📦 energyplanning/
├── docs/
│   ├── ARCHITECTURE.md        ← Technische Architektur
│   ├── CALCULATIONS.md        ← Formeln & Methoden
│   └── DEPLOYMENT.md          ← Produktivgang
├── tests/
│   ├── unit/                  ← Unit Tests
│   └── integration/           ← Integrationstests
├── .env.example
├── .editorconfig
├── CONTRIBUTING.md
├── SECURITY.md
└── CHANGELOG.md
```

---

## 7. ACTION ITEMS (Priorität)

### 🔴 HIGH (kritisch):
- [ ] Inline-Styles aus HTML/JS in CSS auslagern
- [ ] Hardcodierte Farben in data.json
- [ ] Chart-Resize in PDF-Export mit Error-Handling

### 🟡 MEDIUM (wichtig):
- [ ] Accessibility: form Labels, ARIA, Keyboard-Nav
- [ ] SEO: Meta-Tags, JSON-LD, robots.txt
- [ ] Fehlende Projektdateien (.editorconfig, CONTRIBUTING.md)

### 🟢 LOW (nice-to-have):
- [ ] Performance: Caching, Debounce
- [ ] Unit Tests
- [ ] Dokumentation (Architecture, Calculations)

---

## Nächste Schritte
1. Alle CSS-Styles in `style.css` zusammen
2. Alle Farben/Konstanten in `data.json` oder neuer `config.json`
3. Barrierefreiheit-Audit durchführen
4. README.md & neue Docs schreiben
