# Security Policy

## Reporting Security Issues

**Bitte melden Sie Sicherheitslücken NICHT öffentlich via Issues.**

Senden Sie Details vertraulich an: security@example.com

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

**Zuletzt aktualisiert:** 2025-12-04
