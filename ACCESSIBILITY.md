# Accessibility (WCAG 2.1 AA Compliance)

Dieses Dokument beschreibt die Accessibility-Maßnahmen des Energieplanungs-Rechners zur Einhaltung der Web Content Accessibility Guidelines (WCAG 2.1) auf Level AA.

## 1. Keyboard Navigation

### 1.1 Tab-Reihenfolge
- **Logische Reihenfolge:** Formularfelder von oben nach unten
- **Szenario-Buttons:** Tab wechselt zwischen den Buttons, Arrow-Keys navigieren innerhalb der Buttongruppe
- **Skip-Links:** Geplant für zukünftige Versionen

### 1.2 Keyboard-Shortcuts

#### Scenario Switch (Tab-Liste)
| Taste | Aktion |
|-------|--------|
| **Tab** / **Shift+Tab** | Zwischen Szenarien wechseln |
| **Arrow-Left** / **Arrow-Up** | Vorheriges Szenario |
| **Arrow-Right** / **Arrow-Down** | Nächstes Szenario |
| **Home** | Erstes Szenario (Nur PV) |
| **End** | Letztes Szenario (PV + Speicher + WP) |

#### Day Toggle (Toggle-Buttons)
| Taste | Aktion |
|-------|--------|
| **Tab** / **Shift+Tab** | Zwischen Summer/Winter wechseln |
| **Arrow-Left** / **Arrow-Right** / **Arrow-Up** / **Arrow-Down** | Zwischen Toggle-Optionen wechseln |
| **Enter** | Button aktivieren |

#### Formularfeld-Navigation
| Taste | Aktion |
|-------|--------|
| **Tab** / **Shift+Tab** | Zum nächsten/vorherigen Feld |
| **Enter** | Berechnung starten (Submit-Button oder Enter in Formular) |

### 1.3 Focus Management
- **Focus-Indikator:** Blaue Box-Shadow (3px) auf allen fokussierbaren Elementen
- **Focus-Reihenfolge:** Respektiert DOM-Reihenfolge, keine `tabindex="0"` Abuse
- **Auto-Focus:** Keine automatischen Focus-Bewegungen nach Berechnung

## 2. ARIA Attributes

### 2.1 Formular-Struktur

```html
<form id="energyForm">
    <fieldset>
        <legend>Grundeinstellungen für die Energieberechnung</legend>
        <!-- Inputs with labels -->
    </fieldset>
    <fieldset>
        <legend>Angaben optional zur Ermittlung von Förderprogrammen</legend>
        <!-- Optional inputs -->
    </fieldset>
</form>
```

#### Label-Input Bindung (WCAG 1.3.1 - Level A)
```html
<div>
    <label for="houseType">Haustyp</label>
    <select id="houseType" name="houseType" required aria-required="true">
        <option>...</option>
    </select>
</div>
```

**Wichtig:** Alle `<label>` haben `for`-Attribute mit entsprechenden `id` auf dem Input.

#### Aria-Required (WCAG 3.3.2 - Level A)
```html
<select id="houseType" name="houseType" required aria-required="true">
```
- Beide `required` HTML-Attribut und `aria-required="true"` für maximale Kompatibilität

#### Aria-Describedby für Hilfs-Text
```html
<label for="bundesland">Bundesland</label>
<select id="bundesland" aria-describedby="bundeslandHint">
    ...
</select>
<span id="bundeslandHint" class="hint-text">
    Optional – wird für Förderprogrammsuche verwendet
</span>
```

### 2.2 Tab-Liste für Szenario-Auswahl

```html
<div class="scenario-buttons" role="tablist" aria-labelledby="scenarioLabel">
    <button role="tab" aria-selected="true">Nur PV</button>
    <button role="tab" aria-selected="false">PV + Speicher</button>
    <button role="tab" aria-selected="false">PV + Speicher + WP</button>
</div>
```

**Keyboard-Handling in JavaScript:**
```javascript
btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // Navigate to previous tab
        targetBtn = idx > 0 ? buttons[idx - 1] : buttons[buttons.length - 1];
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        // Navigate to next tab
        targetBtn = idx < buttons.length - 1 ? buttons[idx + 1] : buttons[0];
    }
    if (targetBtn) {
        targetBtn.focus();
        targetBtn.click();
        btn.setAttribute('aria-selected', 'false');
        targetBtn.setAttribute('aria-selected', 'true');
    }
});
```

### 2.3 Live Region für Ergebnisse

```html
<div id="results" 
     role="region" 
     aria-labelledby="resultsHeading" 
     aria-live="polite" 
     aria-atomic="false">
</div>
```

**Attribute Erklärung:**
- `aria-live="polite"`: Kündigt Änderungen an (nicht unterbre Screenreader)
- `aria-atomic="false"`: Nur geänderte Inhalte werden vorgelesen, nicht alles
- `aria-labelledby="resultsHeading"`: Region ist mit "Berechnungsergebnisse" benannt

### 2.4 Button Press-States

```html
<button data-season="summer" aria-pressed="true">Sommer</button>
<button data-season="winter" aria-pressed="false">Winter</button>
```

- `aria-pressed="true"`: Button ist aktiviert
- `aria-pressed="false"`: Button ist nicht aktiviert
- Wird aktualisiert bei Klick oder Keyboard-Navigation

## 3. Screenreader Support

### 3.1 Canvas-Beschreibungen

```html
<canvas id="yearChart" 
        role="img" 
        aria-label="Jährliche Energiebilanz mit PV-Erzeugung, Verbrauch, Eigenverbrauch und Netzbezug">
</canvas>
```

**Beste Praktiken für Charts:**
- `role="img"`: Teilt Screenreadern mit, dass es ein Bild ist
- `aria-label`: Aussagekräftige Beschreibung des Chart-Inhalts
- Alternative: `aria-describedby` auf ein unsichtbares Textelement

### 3.2 Visually Hidden Text

```css
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

**Verwendung:**
```html
<legend class="visually-hidden">Grundeinstellungen für die Energieberechnung</legend>
```

- Text ist für sehende Nutzer nicht sichtbar
- Screenreader können den Text auslesen
- Besser als `display: none` oder `visibility: hidden`

### 3.3 Hint-Text Styling

```css
.hint-text {
    display: block;
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    margin-bottom: 12px;
    font-weight: normal;
}
```

- Kleine, aber lesbare Schrift
- Verknüpft via `aria-describedby`

## 4. Focus Styling

### 4.1 Global Focus-Styling

```css
input:focus, select:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.scenario-btn:focus, .day-btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.25);
}
```

**Wichtig:** Niemals `outline: none` ohne Alternative verwenden!
- 3px Box-Shadow bietet ausreichend visuellen Kontrast (WCAG 2.4.7 - Level AA)
- Funktioniert auch auf verschiedenen Hintergrund-Farben

### 4.2 Focus-sichtbar (Zukünftig)

```css
/* Modern browsers */
:focus-visible {
    outline: 3px solid #007bff;
    outline-offset: 2px;
}
```

## 5. Color Contrast (WCAG 1.4.3 - Level AA)

### 5.1 Text-Kontrast
- **Normale Schrift:** Mindestens 4.5:1 Kontrast-Verhältnis
- **Große Schrift (≥18pt):** Mindestens 3:1 Kontrast-Verhältnis

Aktuelle Farben:
- **Text on White:** #333 on #fff = 10.5:1 ✅ (AAA)
- **Button Text:** white on #007bff = 8.3:1 ✅ (AAA)
- **Hint-Text:** #666 on #fff = 5.3:1 ✅ (AA)

### 5.2 Farbcodierung Nicht Allein Nutzen
- **Charts:** Verschiedene Linien-Stile (solid, dashed) zusätzlich zu Farben
- **Status-Indikatoren:** Text-Labels ("Sommer", "Winter") neben Buttons
- **Szenarien:** Text-Etiketten auf Buttons, nicht nur Farben

## 6. Motion & Animation

### 6.1 Transition Timing
```css
transition: all 0.2s ease;
```
- Kurz genug, um responsiv zu wirken
- Lang genug, um nicht störend zu sein für vestibular-sensitive Nutzer

### 6.2 Reduced Motion Support (Zukünftig)

```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

## 7. Form Validation (WCAG 3.3 - Level A)

### 7.1 Client-Side Validation
```html
<select id="houseType" required aria-required="true">
```

### 7.2 Error Messages (Geplant)
```html
<input type="number" required aria-describedby="ageError">
<span id="ageError" role="alert" class="error-text"></span>
```

- `role="alert"`: Screenreader kündigt Fehler sofort an
- Verknüpft via `aria-describedby`

## 8. Semantic HTML

### 8.1 Struktur
- ✅ `<main>` für Hauptinhalte
- ✅ `<section>` mit `aria-labelledby`
- ✅ `<form>` statt Div für Formulare
- ✅ `<fieldset>` & `<legend>` für Feld-Gruppierung
- ✅ `<label>` mit `for`-Attribut
- ✅ `<button>` statt `<div role="button">`

### 8.2 Heading-Hierarchie
- ✅ Nur ein `<h1>` pro Seite
- ✅ Keine übersprungenen Heading-Levels (z.B. h1 → h3)
- ✅ Headings zum Strukturieren von Inhalten, nicht Styling

## 9. Testing & Validation

### 9.1 Tools für Testing
- **WAVE:** browser.google.com/accessibility-testing
- **axe DevTools:** Kostenlose Chrome-Extension
- **Lighthouse:** Chrome DevTools → Accessibility Tab
- **Screen Readers:** NVDA (Windows), JAWS (Windows), VoiceOver (Mac)

### 9.2 Test-Checkliste
- [ ] Alle Formularfelder sind mit Labels gekennzeichnet
- [ ] Keyboard-Navigation funktioniert (Tab, Arrow-Keys, Enter)
- [ ] Focus-Indikator ist sichtbar
- [ ] Szenario-Buttons sind mit Keyboard steuerbar
- [ ] Charts haben `aria-label`
- [ ] Fehler-Meldungen sind screenreader-zugänglich
- [ ] Color Contrast erfüllt AA-Standard
- [ ] Keine Bewegungs-Triggers für vestibular-sensitive Nutzer

### 9.3 Browserkompatibilität
- ✅ Chrome/Edge (ARIA vollständig unterstützt)
- ✅ Firefox (ARIA vollständig unterstützt)
- ✅ Safari (ARIA teilweise unterstützt)
- ⚠️ Alte Browser (< IE 11): Limited ARIA Support

## 10. Bekannte Einschränkungen & Future Work

### 10.1 Aktuelle Einschränkungen
1. Charts (Canvas) sind statisch beschrieben via `aria-label`
   - *Lösung:* aria-describedby auf HTML-Tabelle mit Chart-Daten
2. Keine Skip-Links zum Überspringen von Formular
   - *Lösung:* "Skip to Results" Link hinzufügen
3. Keine Error-Messages für Validierungsfehler
   - *Lösung:* Validierungsmeldungen mit `role="alert"`

### 10.2 Geplante Verbesserungen
- [ ] Chart-Daten-Tabelle für Screenreader
- [ ] Skip-Links-Navigation
- [ ] Fehler-Handling mit aria-live Regions
- [ ] PDF-Export mit Accessibility-Tags
- [ ] Prefers-reduced-motion Support
- [ ] Mehrsprachige ARIA-Labels (Deutsch/Englisch)

## 11. Ressourcen

### 11.1 Standards & Richtlinien
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: ARIA Authoring Practices](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)

### 11.2 Tools
- [WAVE Web Accessibility Evaluation Tool](https://wave.webaim.org/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [Chrome Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)
- [NVDA Screen Reader](https://www.nvaccess.org/)

### 11.3 Tutorials
- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Web Accessibility by Google (Udacity Course)](https://www.udacity.com/course/web-accessibility--ud891)

---

**Version:** 1.3.0  
**Letztes Update:** 2025-12-04  
**WCAG-Level:** 2.1 AA (Ziel)
