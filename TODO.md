# TODO – Energetische Modernisierungs-Rechner

Offene Aufgaben nach Priorität. Abgeschlossene Punkte in CHANGELOG.md dokumentieren.

---

## 🔴 High (kritisch)

- [x] `innerHTML` mit server-seitigem Inhalt in `scripts/script.js` durch sichere DOM-Erstellung ersetzen
- [x] PDF-Regeln zentral in `style.css` pflegen; kein Inline-`<style>` Block mehr vorhanden
- [x] `performance.js` in `index.html` einbinden und Initialisierung aktivieren

---

## 🟡 Medium (wichtig)

- [x] `scripts/script.js` aufteilen: Berechnungskern, sichere Förder-UI, PDF-Export und Charts in separate Module
- [x] `data/tmp/` aus Git entfernen
- [x] Sitemap `lastmod`-Datum ergänzen und automatisch aktualisieren
- [x] IntersectionObserver-Lazy-Loading auf das vorhandene Target `#results` umstellen
- [x] GitHub-Workflow auf gepinnte Python-Abhängigkeiten umstellen
- [x] `houseAge`-Feld um verständliche Aktivierungs-Beschriftung ergänzen
- [x] Förderprogramm-Ausgabe in das sichere Modul `scripts/subsidy-ui.js` auslagern

---

## 🟢 Low (nice-to-have)

- [x] Asset-Versioning in `index.html` für Cache-Busting
- [x] Minifizierung von JavaScript und CSS im Deployment-Prozess
- [x] Service Worker / Offline-Fallback für localStorage-Cache
- [x] `CONTRIBUTING.md` um konkreten Branch-Workflow ergänzen (feature/bugfix-Branches)
- [x] Open Graph Image (og:image) gegen echtes Screenshot-Bild tauschen
- [x] Regelmäßige PageSpeed-/Lighthouse-Messung über Webcheck in README dokumentieren

---

## ✅ Erledigt (zuletzt)

- [x] WCAG 2.1 Level AA – Accessibility vollständig implementiert (v1.3.0)
- [x] robots.txt, sitemap.xml, .well-known/security.txt angelegt
- [x] CSP, HSTS, Security-Header in .htaccess konfiguriert
- [x] SRI-Integrity-Hash für Chart.js CDN-Einbindung
- [x] requirements.txt, .env.example ergänzt
- [x] README Duplikate entfernt, CHANGELOG finalisiert

## Strukturharmonisierung

- [x] Doppelte README-Struktur- und Konfigurationsabschnitte zusammenführen.
- [x] Deployment-Pfade `builds/full-deployment/` und `builds/delta-deployment/` im Deployment-Dokument gegen FPF-Zielstandard einordnen.
- [x] Produktive Browser-Skripte und lokale Fetch-/Testskripte in `scripts/` deutlicher dokumentieren.

