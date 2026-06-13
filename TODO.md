# TODO – Energetische Modernisierungs-Rechner

Offene Aufgaben nach Priorität. Abgeschlossene Punkte in CHANGELOG.md dokumentieren.

---

## 🔴 High (kritisch)

- [ ] `innerHTML` mit server-seitigem Inhalt in `scripts/script.js` (Zeilen 766, 800) durch sichere DOM-Erstellung ersetzen
- [ ] Inline-`<style>` Block in `index.html` (PDF-Regeln) nach `style.css` auslagern
- [ ] `performance.js` wird nicht in `index.html` eingebunden – prüfen, ob Caching/Debouncing aktiviert ist

---

## 🟡 Medium (wichtig)

- [ ] `scripts/script.js` aufteilen: Berechnungslogik / UI / PDF-Export / Charts in separate Module
- [ ] `data/tmp/` aus Git entfernen (leer, wird von Skripten genutzt)
- [ ] Sitemap `lastmod`-Datum ergänzen und automatisch aktualisieren
- [ ] IntersectionObserver-Lazy-Loading in `performance.js` – Observer-Target `#result` vs. `#results` prüfen (ID-Mismatch)
- [ ] GitHub-Workflow: Pinned Dependency-Versionen (`openai`, `python-dotenv`, `httpx`)
- [ ] `houseAge`-Feld in `index.html` ist immer `disabled` bis Bundesland gewählt – Fallback-Beschriftung ergänzen
- [ ] Förderprogramm-Links aus `script.js` Zeile 766 HTML-Template in separates Template-System auslagern

---

## 🟢 Low (nice-to-have)

- [ ] Asset-Versioning in `index.html` (`style.css?v=1.3.0`) für Cache-Busting
- [ ] Minifizierung von `script.js` und `style.css` im Deployment-Prozess
- [ ] Service Worker / Offline-Fallback für localStorage-Cache
- [ ] `CONTRIBUTING.md` um konkreten Branch-Workflow ergänzen (feature/bugfix-Branches)
- [ ] Open Graph Image (og:image) gegen echtes Screenshot-Bild tauschen
- [ ] Lighthouse-Score regelmäßig messen und in README aktualisieren

---

## ✅ Erledigt (zuletzt)

- [x] WCAG 2.1 Level AA – Accessibility vollständig implementiert (v1.3.0)
- [x] robots.txt, sitemap.xml, .well-known/security.txt angelegt
- [x] CSP, HSTS, Security-Header in .htaccess konfiguriert
- [x] SRI-Integrity-Hash für Chart.js CDN-Einbindung
- [x] requirements.txt, .env.example ergänzt
- [x] README Duplikate entfernt, CHANGELOG finalisiert
