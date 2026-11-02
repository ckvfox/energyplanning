# Förderinformationen: NRW-Prüfung und Veröffentlichung

Prüfstand: 01.11.2026. Zielgruppe: private Eigentümer bestehender Wohngebäude in
NRW, insbesondere PV/Speicher und späterer Heizungstausch in Pulheim.
Keine Änderung der Energie-, Kosten- oder Amortisationsannahmen.

## Ergebnis der vollständigen NRW-Bestandsprüfung

Die elf alten Einträge sind mit Originalwortlaut und Status
`unverified_withdrawn_do_not_apply` in `subsidies-nrw-withdrawn.json` archiviert.
Sie sind keine nutzbaren Förderzusagen. Nichtbestätigung bedeutet nicht,
dass es keinerlei ähnlich benannte Angebote geben kann.

| Bisheriger Eintrag / Kategorie | Befund und Korrektur |
| --- | --- |
| NRW.BANK.Wohnraum.Bauen / PV | Konkreter Förderumfang für private Bestandsmodernisierung nicht belegt; durch NRW.BANK.Gebäudesanierung ersetzt. |
| KfW 271/272 Standard / PV | Falsche Zuordnung; 270 Standard als Kredit, ohne Zuschuss. |
| BAFA Heizungsoptimierung und Erneuerbare Energien / PV | Unbelegte PV-/Speicherzuschüsse zurückgezogen; Optimierung nur in passender Kategorie. |
| NRW.BANK Energieeffizient Sanieren – Zuschuss / WP | Konkreter Zuschuss nicht bestätigt; 458 und belegte Kredite getrennt. |
| MAP – BEG / WP | Unpräzise historische Sammelbezeichnung; 458 als eigenständiges Angebot. |
| NRW.BANK Energieeffizienz- und Klimaschutzprogramm / WP | Private Bestandsförderfähigkeit unter diesem Namen nicht bestätigt; Gebäudesanierung verwendet. |
| Wohngebäude-Programm NRW / Optimierung | Unspezifisch; durch konkrete BAFA- und Bankangebote ersetzt. |
| BEG Einzelmaßnahmen / Optimierung | Zuständigkeit und Art getrennt: BAFA-Zuschuss, KfW-Ergänzungskredit. |
| Heizen mit Erneuerbaren Energien NRW / Hülle | Name/Zugang nicht belegt, Kategorie falsch; zurückgezogen. |
| KfW Energieeffizient Sanieren / Hülle | 261 nur für Effizienzhaus-Gesamtsanierung; BAFA für Einzelmaßnahmen. |
| NRW.BANK.Bauen und Wohnen Plus / Hülle | Konkreter Name und behauptete Zuschüsse nicht bestätigt; Gebäudesanierung verwendet. |

Die zuvor leere Speicherkategorie enthält jetzt belegte Kredit- und Steuerhinweise.
Kommunale oder weitere NRW-Zuschüsse sind damit weder zugesagt noch ausgeschlossen;
ein für Pulheim allgemein zugänglicher direkter PV-/Speicherzuschuss wurde in
jetzt geprüften Einträgen nicht belegt. Keine Vollständigkeitsbehauptung.

## Quellen und Grenzen

Direkte Programmseiten und Beleglinks stehen je Eintrag in `data/subsidies.json`.
KfW 270, 458, 358/359 und 261 wurden anhand ihrer offiziellen Produktseiten
abgeglichen. NRW.BANK.Gebäudesanierung wurde zusätzlich mit dem konkreten
Eintrag der Förderdatenbank des Bundes abgeglichen. Der PV-Nullsteuersatz und
§ 35c wurden anhand des BMF geprüft. § 35c ist eine Alternative für qualifizierte
energetische Maßnahmen, keine pauschale Kumulationsmöglichkeit.

BAFA-HTML-Programmseiten lieferten beim direkten Abruf HTTP 403. Die Zuordnung
wurde deshalb über offizielle BAFA-Downloads und die aktuelle BEG-FAQ des
Bundesministeriums gegengeprüft. Die Downloads tragen teilweise einen älteren
Stand. Aktuelle Detailkonditionen sind dadurch nicht vollständig bestätigt;
daher keine festen BAFA-Fördersätze oder Bonuswerte übernommen. Ebenso keine
ungeprüfte Fortschreibung älterer KfW-Bonussätze. `reviewed` bestätigt die
belegte Programmzuordnung und Förderart, keine individuelle Bewilligung oder
Garantie unveränderter Konditionen. Nach 180 Tagen zeigt die UI einen erneuten
Prüfbedarf. Vor Vertragsabschluss ist immer eine erneute Prüfung nötig.

## Ursache und Schutz

Commit `16d05d23f8af400727dd7390eca304e5d351543f` enthielt 350 Einfügungen und
366 Löschungen in Förder-JSON und Sitemap. Der Fetcher fragte ein Modell ohne
Recherchewerkzeug ab; System-/Nutzerprompt hatten widersprüchliche Felder.
Die Validierung prüfte nur das Vorhandensein dreier Schlüssel. Quellen und
Prüfdatum wurden verworfen, generische Portale nach Ebene erzeugt. Jede Antwort,
auch `[]` nach Fehlern, ersetzte den bisherigen Inhalt. Der Workflow commitete
direkt auf main und löste über workflow_run einen produktiven Upload aus.

Jetzt schreibt der Fetcher ausschließlich ausdrücklich unbestätigte Vorschläge
außerhalb des Repositories. Das CLI verweigert Repository-Ziele einschließlich
aufgelöster Symlinks. Monatsjob: `contents: read`, kein Commit/Push, kein
Deployment-Trigger; Vorschlag 30 Tage als Actions-Artefakt. Fehler/leere
Antworten verändern produktive Daten nicht. Modellangaben sind keine Quellenprüfung.

Übernahme: konkrete Programmseite öffnen, Aktualität, Zielgruppe, Maßnahmen,
Förderart, Antragstermin und Kombinationen prüfen; Quellen, Zugang, ID und
Prüfdatum manuell dokumentieren, dann PR mit menschlichem Fachreview.
`python scripts/validate_subsidies.py` ist ein verpflichtendes CI-/Deployment-Gate
für Struktur, Datum, offizielle Deep-Links und konsistente Programmidentitäten;
es bestätigt keine Wahrheit einer Webseite. Keine automatische Freigabe durch
Modell-generierte Prüffelder. Andere Bundesländer bleiben fachlich ungeprüft;
ihre alten Beschreibungen werden in der UI durch einen Unbestätigt-Hinweis ersetzt.

## Verifikation

Offline-Tests prüfen Nichtmutation, verweigerte produktive Ausgabeziele,
fehlerhafte Review-Metadaten/URLs, NRW-Zuordnung, Darstellung und Deduplizierung.
DOM-Tests sind keine visuelle Browserabnahme. Vor Freigabe Tests und FPF ausführen.

Lokale Prüfung: 27 Python-Tests und 17 Node-Tests bestanden, Ruff und FPF bestanden.
Berechnungsmatrix mit 5.832 Fällen ausgeführt; Produktionspaket gebaut und per
DOM getestet. `data/data.json`, Berechnungskern und Chart-Berechnungen bleiben
unverändert. Nur Fördertexte und Deduplizierung in `script.js` ändern dessen
Gesamthash; `docs/calculation-review.json` wurde nach Diffprüfung nachgeführt.
Lokale Installation des gesamten Python-3.11-Manifests scheiterte unter Python
3.12 am alten Pandas-Pin; für diese Prüfungen wurden die exakt gepinnten
Updater-/Build-Abhängigkeiten separat installiert, die Repository-Pins blieben bestehen.


## Abschlussprüfung 02.11.2026

Offizielle KfW-Produktseiten 270, 458, 358/359 und 261, NRW.BANK.Gebäudesanierung,
BMF-PV-FAQ und § 35c sowie amtliche BEG-FAQ/BAFA-Belege erneut abgeglichen.
KfW 261 präzisiert: 65-%-Anforderung für Wärme/Kälte und kein pauschaler
Basis-Tilgungszuschuss für jede förderfähige Effizienzhausstufe.
BAFA-HTML weiterhin mit 403 nicht abrufbar; aktuelle Detailkonditionen bleiben
vor Antrag zu prüfen. Keine festen Fördersätze aus älteren Belegen übernommen.

Nachgewiesene UI-Dubletten ohne Programm-ID in BY und BB werden jetzt anhand
von Titel, Förderebene und Link nur einmal angezeigt; ungeprüfte Beschreibungen
bleiben ausgeblendet. NRW-Identitäten werden weiterhin nach Programm-ID dedupliziert.
Zusätzlicher DOM-Regressionstest deckt die tatsächlichen BY-/BB-Bestände ab.

Visuelle Desktop-/Mobilabnahme des PR-Stands nicht möglich: Der verfügbare
Cloud-Browser erreicht den lokalen Testserver nicht (Port 8000 liefert eine
fremde Bearer-Token-Fehlerseite). DOM- und Produktionspaketprüfungen ersetzen
keine visuelle Layoutabnahme. Diese Einschränkung ist bei der Freigabe offengelegt.
