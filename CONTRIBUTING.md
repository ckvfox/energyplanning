# Contributor's Guide

Vielen Dank für dein Interesse, zum Energetische-Modernisierung-Rechner beizutragen!

## Branching Strategy

- **main** – Stabil, produktiv
- **develop** – Entwicklung, testing
- Feature-Branches: `feature/beschreibung`
- Bugfix-Branches: `bugfix/problembeschreibung`

Neue Arbeit beginnt immer auf einem eigenen `feature/*`- oder `bugfix/*`-Branch
vom aktuellen `develop`. Nach Review wird nach `develop` integriert; nur getestete
Stände werden per Pull Request nach `main` übernommen. Direkte Funktionscommits
auf `main` sind nicht vorgesehen.

## Development Setup

```bash
git clone https://github.com/ckvfox/energyplanning.git
cd energyplanning

# Lokaler Server (Python)
python -m http.server 8000
# oder Node.js
npx http-server -p 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Code Style

- **JavaScript:** camelCase für Variablen, UPPER_CASE für Konstanten
- **CSS:** kebab-case für Klassen, Nesting max 2 Ebenen
- **JSON:** 2-Space Indentation
- **HTML:** Semantic HTML5, ARIA-Labels für Accessibility

## Testing

```bash
# Manuelles Testing
- Verschiedene Browser: Chrome, Firefox, Safari
- Responsive: Desktop, Tablet, Mobile
- Szenarien durchspielen: PV-only, +Speicher, +Wärmepumpe

# Datenvalidation
python -m json.tool data/data.json > /dev/null  # Syntax-Check
```

## Pull Request Process

1. **Branch erstellen:** `git checkout -b feature/meine-funktion`
2. **Commits:** Aussagekräftige, atomare Commits
   - ✅ `Add energy balance calculation for heat pump scenarios`
   - ❌ `Fix stuff`, `Update`
3. **Push & PR:** Beschreibung ausfüllen, Checklist abhaken
4. **Review:** 1 Maintainer-Approval notwendig
5. **Merge:** Squash if multiple commits, dann löschen

## Reporting Issues

**Bug Report:**
```
Title: [BUG] Speicher-Größe wird zu klein berechnet

Beschreibung:
- Schritt 1: Reihenhaus, 100m², 4 Personen auswählen
- Schritt 2: "PV + Speicher" Szenario wählen
- Tatsächlich: Speicher 3 kWh
- Erwartet: Speicher ~7 kWh

Browser: Chrome 120, Ubuntu 22.04
```

**Feature Request:**
```
Title: [FEATURE] Mehrsprachigkeit (EN, FR)

Beschreibung: App auch auf Englisch/Französisch verfügbar machen
Nutzen: Europäische Benutzer
```

## Documentation Changes

- CHANGES in `docs/` Ordner dokumentieren
- Formeln in `docs/CALCULATIONS.md` erklären
- Architektur-Updates in `docs/ARCHITECTURE.md`

## Questions?

- Offene Issues durchsuchen
- GitHub Discussions verwenden
- Falls keins zutrifft: Neues Issue erstellen

---

**Happy Contributing! 🚀**
