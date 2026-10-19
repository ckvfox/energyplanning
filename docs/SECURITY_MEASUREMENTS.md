# Security-Messungen auf Shared Hosting

## Befund vom 19.10.2026

Referenz des Auftrags: Webcheck 2026-10-19T10:16:09Z. Dessen Rohreport und
exakter User-Agent liegen hier nicht vor. Der eigene HTTP-Gegentest erfolgte
2026-10-19T10:25:35Z gegen die oeffentliche Website.

| Anfrage | Audit-Profil | Browser-Profil |
| --- | --- | --- |
| HTTPS `/` | HTTP 200, Hoster-JS-Challenge | HTTP 200, Hoster-JS-Challenge |
| HTTPS `/index.html` | HTTP 200, Hoster-JS-Challenge | HTTP 200, Hoster-JS-Challenge |
| HTTP `/index.html` | HTTP 200, Hoster-JS-Challenge | HTTP 200, Hoster-JS-Challenge |

Erkennung: gemeinsame Signaturen `/aes.js` und `slowAES` im Antwortkoerper.
Es wurde kein eigener Policy-Marker beobachtet. Die Antworten erlauben keine
Bewertung der Projekt-Header oder Apache-Redirects. Ein User-Agent-Unterschied
wurde in diesem begrenzten Vergleich nicht beobachtet; IP-, Zeit-, Cache- und
Browserzustand bleiben moegliche Einflussfaktoren. Das Browser-Profil bezeichnet
einen HTTP-Abruf mit Browser-UA, keinen JavaScript-ausfuehrenden Browser.

## Reproduzierbarer Audit

Die anschliessend bereitgestellten Serverkopien bestaetigen die Trennung:
Die FTP-Root-Datei definiert DirectoryIndex und externe ErrorDocument-Ziele
fuer 403/404/500, aber keine JS-Challenge oder UA-Regeln. Die Kopie aus
`/energyplanning.great-site.net/htdocs/.htaccess` enthaelt die bisherigen
Projektregeln, ebenfalls ohne Challenge oder UA-Sperre. Die beobachtete
Challenge wird ausserhalb dieser beiden Dateien erzeugt. `Vary: User-Agent`
allein stellt keine unterschiedliche Auslieferung her.

Die geerbte externe 403-Fehlerseite kann einen eigenen Forbidden-Befund in
eine Weiterleitung zum Hoster verwandeln. Deshalb setzt ausschliesslich die
Projektdatei `ErrorDocument 403 default`, damit Status 403 und Diagnoseheader
erhalten bleiben koennen. Die FTP-Root-Datei wird nicht geaendert.
Uploadziel der Projektdatei ist
`/energyplanning.great-site.net/htdocs/.htaccess`; der lokale Kopienname
`.htaccess2` ist kein produktiver Dateiname. Die Serverkopie enthaelt zudem
noch die aeltere Permissions-Policy und kein CDN-Source-Map-connect-src.

```powershell
python scripts/security_audit.py
python scripts/security_audit.py --audit-user-agent "<exakter zentraler Webcheck-UA>"
python -m unittest discover -s scripts -p test_security_audit.py
```

Der Standard-Audit-UA ist `EnergyPlanning-Webcheck/1.0`; er wird nicht als der
unbekannte zentrale Webcheck-UA ausgegeben. Der Browser-UA steht in `PROFILES`.
Das Werkzeug ist lokal/CI und wird durch die bestehende produktive Positivliste
nicht hochgeladen. Es sendet keine Cookies, loest keine Challenges und fuehrt
kein JavaScript aus. JSON enthaelt nur abgeleitete Befunde, keine Antwortkoerper,
Cookie-/Sessiondaten, rohen Header oder Redirect-Querystrings.

| Klassifikation | Bedeutung fuer Security-Reports |
| --- | --- |
| `hoster_js_challenge` | Bekannte Hoster-Signaturen; Projekt-Header nicht beurteilbar |
| `project_htaccess_denial` | HTTP 403 mit explizitem Marker der bestehenden Hidden-Path-Regel |
| `access_denied_unknown_source` | 401/403/429 ohne Herkunftsnachweis; nicht automatisch eigene Regel oder Hoster |
| `http_redirect` | HTTP-Weiterleitung separat protokolliert und begrenzt verfolgt |
| `application` | HTTP 200 mit passendem Canonical und Projekt-Skript; Header auswertbar |
| `unexpected_response` / Transportfehler | Kein verlaesslicher Projektseitenbefund |

`X-EnergyPlanning-Policy: apache-v1` zeigt beobachtete Projektkonfiguration,
beweist allein aber weder Seitenidentitaet noch die Ursache einer Sperre.
`X-EnergyPlanning-Denial: hidden-path` markiert ausschliesslich die bereits
vorhandene Hidden-Path-Sperre. Es entstehen keine neuen Zugangssperren.
Header werden nur fuer erkannte Projektseiten bewertet. Policy-Fingerprints
erkennen Unterschiede ohne rohe Header zu speichern. UA-Vergleiche melden
beobachtete Unterschiede, keine bewiesene Ursache. Exitcodes: `0` auswertbare
Antworten ohne implementierte Findings, `1` Findings, `2` unvollstaendige bzw.
nicht beurteilbare Messung. Dies ist kein vollstaendiger Vulnerability-Scanner.
Zentrale Webcheck-Reports muessen diese Klassifikation uebernehmen; das zentrale
Webcheck-Repository wird durch diese lokale Aenderung nicht angepasst.

## Canonical und Ressourcenvertrag

Die vorhandenen HTML-Canonicals sind korrekt und bleiben bestehen. Apache
normalisiert explizite `/index.html`-Requests direkt auf
`https://energyplanning.great-site.net/`, auch bei HTTP oder anderem Host.
Querystrings bleiben erhalten. `THE_REQUEST` verhindert Schleifen durch interne
DirectoryIndex-/Fallback-Aufloesung. Ein HTTP-Link-Header bestaetigt den Canonical
fuer `index.html`. Die feste Domain verhindert das Spiegeln fremder Host-Header.
Proxy-HTTPS-Erkennung bleibt fuer den bestehenden Shared Host erhalten.
Es gibt keine eigenen JavaScript- oder Meta-Refresh-Redirects. Eine vorgelagerte
Hoster-Challenge kann weiterhin eigene JavaScript-Navigation ausloesen; diese
laesst sich nicht durch Projekt-Rewrites beseitigen. Ohne eigene UA-Varianten
entfaellt das bisherige projektseitige `Vary: User-Agent`.

Ressourceninventar vor der CSP-Aenderung:

- Externes Skript: Chart.js 4.4.3, exakte jsDelivr-Datei mit vorhandenem SRI.
  Das CDN ist in `script-src` nur fuer dieses Skript erlaubt. Das bestehende
  `connect-src https://cdn.jsdelivr.net` bleibt fuer die seit Version 1.4.2
  dokumentierten Chart.js-Source-Map-Anfragen erhalten.
- Styles: lokales `style.css`, bestehende Inline-Styles/dynamische
  `element.style`-Zuweisungen und Chart.js. `style-src 'unsafe-inline'` bleibt
  fuer diese Kompatibilitaet bestehen.
- Ein Inline-JSON-LD-Block mit passendem SHA-256-Hash; unbenutzter alter Hash
  entfernt. Keine Inline-Event-Handler in den drei produktiven HTML-Seiten;
  `script-src-attr 'none'` ist explizit.
- Keine eingebetteten Karten oder Iframes; Charts sind lokale Canvas-Elemente.
  `frame-src 'none'`, `worker-src 'self'` fuer den vorhandenen Service Worker.
- Bilder/Fonts lokal bzw. data-URLs, Fetches lokal. PDF-Export nutzt
  `window.print()`; die aelteren html2pdf-Hinweise in der Bestandsdokumentation
  beschreiben keine aktuelle Abhaengigkeit.

`Referrer-Policy: same-origin` unterdrueckt Referrer an externe Ziele und erhaelt
sie intern. Die entfernte CSP-Direktive `block-all-mixed-content` ist obsolet;
`upgrade-insecure-requests` bleibt. HSTS und die weiteren bestehenden Header
werden durch diesen Aenderungssatz nicht erweitert.

Grundlagen: [CSP-Direktiven](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy),
[Referrer-Konfiguration](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Referrer_policy).

## Validierung und verbleibender Zielhost-Test

Offline-Tests decken Klassifikation, unterschiedliche Policies, UA-Vergleiche,
Redirects/Schleifen, HTTP-Fehler, Netzwerkfehler und Ressourcen/CSP-Kompatibilitaet
ab. Die CI fuehrt sie mit aus. Ein lokaler Browser-Test mit den neuen CSP- und
Referrer-Headern bestaetigte Berechnung und Chart-Wechsel ohne Warnungen/Fehler.
Der lokale HTTP-Testserver fuehrt keine Apache-Rewrites aus.

Ein anschliessend gemeldeter Fehler zeigte, dass der bisherige Service Worker
auch CDN- und Browser-Erweiterungsanfragen abgefangen hat. Worker-`fetch()`
unterliegt `connect-src`; dadurch kann ein noch mit alter Policy geladener
Worker Chart.js trotz erlaubtem `script-src` blockieren. Der Worker verarbeitet
jetzt ausschliesslich eigene HTTP(S)-GET-Anfragen. Externe Skripte laedt der
Browser direkt. Cache-Schreibfehler werden abgefangen und ueber `waitUntil`
verfolgt. HTML-Fallbacks gelten ausschliesslich fuer Navigationen, nicht fuer
Skripte oder JSON. Cache v3 loest die alten Projektcaches ab und enthaelt auch
die Berechnungsannahmen. `service-worker.js` erhaelt einen eigenen
`no-cache, max-age=0, must-revalidate`-Header. Sieben Offline-Worker-Tests sichern
diese Fehlerfaelle ab (`node --test scripts/test_service_worker.cjs`).

Fuer diesen Fix sowohl `.htaccess` als auch `service-worker.js` hochladen.
Bei weiterhin aktivem alten Worker einmal in den Browser-Entwicklertools unter
Application / Service Workers die Registrierung fuer diese Website entfernen
und die Seite neu laden. Der allgemeine lokale Browser-Test vor dieser
Fehlermeldung deckte diesen kontrollierten Folgebesuch nicht ausreichend ab.

Nach regulaerem Upload auf Apache sind `/`, `/index.html`, HTTP-/Host-Varianten,
Policy-/Canonical-Header, die vorhandene Denial-Markierung und Proxy-Verhalten
zu bestaetigen. Erwartung: Root ohne eigenen Redirect, Index-Varianten genau
ein permanenter Redirect auf HTTPS-Root. Zusaetzlich Browser ohne Service-Worker-
Cache pruefen und anschliessend Offline-Fallback testen. Bei Hoster-Challenge
bleibt der HTTP-Befund nicht beurteilbar; fehlende Projekt-Header sind dann kein
nachgewiesener Konfigurationsfehler. Dieses Ergebnis bestaetigt kein Deployment.
