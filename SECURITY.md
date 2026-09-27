# Security Policy

## Vulnerability Reporting

**Bitte melden Sie Sicherheitslücken NICHT öffentlich via Issues.**

Melden Sie Sicherheitsprobleme vertraulich über GitHub Security Advisories:
https://github.com/ckvfox/energyplanning/security/advisories/new

Bitte begeben Sie sich auf einen responsiblen Disclosure-Weg:
1. E-Mail mit Beschreibung
2. 90 Tage für Fix + Patch
3. Danach öffentliche Disclosure

## Supported Versions

| Version | Support |
|---------|---------|
| 1.x | ✅ Aktiv |
| 0.x | ❌ Deprecated |

## Known Security Considerations

1. **Clientseitige Verarbeitung**
   - Alle Berechnungen laufen im Browser
   - Keine sensiblen Daten an Server

2. **Third-Party Dependencies**
   - Chart.js – Validierte Version
   - html2pdf – Community-Nutzung
   - Regelmäßige Updates

3. **Input Validation**
   - Numerische Eingaben werden auf Plausibilität geprüft
   - XSS-Schutz: textContent statt innerHTML

## Best Practices für Benutzer

- Verwenden Sie eine aktuelle Browser-Version
- Deaktivieren Sie Browser-Erweiterungen bei Vertrauensproblemen
- Überprüfen Sie, dass Sie von `https://` laden (falls deployed)

## Compliance

- ✅ GDPR: Keine Datenerhebung
- ✅ WCAG 2.1 Level AA (angestrebt)
- ✅ JavaScript: Keine extern geladenen Skripte außer chart.js & html2pdf

---

## Secret Handling

Keine Zugangsdaten, Tokens, Sitzungsdaten oder produktiven Konfigurationen in Repository, Reports oder Deployment-Pakete aufnehmen. Nur neutrale Beispieldateien verwenden.

## Production Hardening

HTTPS, restriktive Security-Header, aktuelle Abhaengigkeiten und eine gepruefte `.htaccess` sind fuer die produktive InfinityFree-Instanz verbindlich.

## Backup Strategy

Vor produktiven Aenderungen einen wiederherstellbaren Stand der veroeffentlichten Dateien sichern. Backups werden nicht im Repository oder im Webroot gespeichert.

## Installer Policy

Dieses statische Projekt benoetigt keinen oeffentlich erreichbaren Installer. Neu eingefuehrte Setup- oder Diagnosewerkzeuge duerfen nicht produktiv ausgeliefert werden.

## Disclosure Policy

Sicherheitsdetails werden bis zur Bereitstellung einer Abhilfe vertraulich behandelt. Oeffentliche Issues enthalten keine ausnutzbaren Details.

## Response Targets

Eingegangene Meldungen sollen innerhalb von fuenf Werktagen bestaetigt und nach Reproduzierbarkeit priorisiert werden.

**Zuletzt aktualisiert:** 2026-09-27
