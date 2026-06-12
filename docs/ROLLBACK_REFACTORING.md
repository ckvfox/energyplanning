# Rollback-Plan fuer das SEO/Security-Refactoring

Diese Anleitung beschreibt, wie die Refactoring-Aenderungen sicher rueckgaengig gemacht werden koennen.

## Betroffene Dateien

- .htaccess
- index.html
- impressum.html
- datenschutz.html
- robots.txt
- scripts/script.js

## Empfohlener Weg (mit Git)

### 1. Aktuellen Stand pruefen

```bash
git status
```

### 2. Optional: Sicherheits-Backup erzeugen

```bash
git add -A
git commit -m "Backup vor Rollback des SEO/Security-Refactorings"
```

### 3. Rollback der genannten Dateien

```bash
git restore .htaccess index.html impressum.html datenschutz.html robots.txt scripts/script.js
```

### 4. Ergebnis pruefen

```bash
git status
git diff
```

## Alternative: Revert ueber Commit

Wenn die Refactoring-Aenderungen bereits als eigener Commit vorliegen:

```bash
git log --oneline
```

Dann den Commit rueckgaengig machen:

```bash
git revert <commit-hash>
```

Vorteil: Der Verlauf bleibt nachvollziehbar, ohne Historie umzuschreiben.

## Selektiver Rollback (nur einzelne Themen)

- Nur Server-Header rueckgaengig: .htaccess wiederherstellen
- Nur SEO-Meta rueckgaengig: index.html, impressum.html, datenschutz.html wiederherstellen
- Nur Fehlerausgabe rueckgaengig: scripts/script.js wiederherstellen

Beispiel:

```bash
git restore .htaccess
```

## Nach dem Rollback testen

- Seite im Browser laden (Desktop + Mobile)
- Formularberechnung und Ergebnisanzeige pruefen
- SEO- und Security-Scan erneut ausfuehren

## Hinweise

- Falls mehrere unabhaengige Aenderungen in denselben Dateien liegen, statt Komplett-Restore besser ein gezieltes git revert oder manuelles Rueckpatchen nutzen.
- Bei produktiven Deployments erst in einer Staging-Umgebung testen.
