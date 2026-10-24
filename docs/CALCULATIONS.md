# Berechnungsgrundlagen und Modellgrenzen

Prüfstand: 24.10.2026. Konfiguration: `data/data.json`; produktiver Rechenkern:
`scripts/calculation-core.js`; Eingaben, Dimensionierung und Ausgabe: `scripts/script.js`.
Der Rechner liefert eine erste Orientierung, keine Fachplanung oder verbindliche Kostenprognose.

## Konfigurierte Annahmen

<!-- assumptions:start -->
| Konfigurationspfad | Modellwert |
|---|---:|
| `pv.yield_per_kwp` | 950 |
| `pv.cost_per_kwp` | 900 |
| `battery.cost_per_kwh` | 750 |
| `heatpump.base_cop` | 3.0 |
| `heatpump.factor_good` | 1.2 |
| `heatpump.factor_bad` | 0.9 |
| `heatpump.factor_fbh` | 1.1 |
| `heatpump.cost_per_kw` | 1500 |
| `heatpump.full_load_hours` | 2000 |
| `prices.electricity_eur_per_kwh` | 0.42 |
| `prices.gas_eur_per_kwh` | 0.12 |
| `prices.feed_in_eur_per_kwh` | 0.08 |
| `inflation.electricity_rate` | 0.02 |
| `inflation.gas_rate` | 0.03 |
<!-- assumptions:end -->

Alle Werte sind Modellannahmen, keine zugesicherten Marktpreise. Die bestehenden
Preiswerte bleiben unverändert. PV-, Speicher- und WP-Kosten sind bezüglich
Gerät, Montage, Elektroarbeiten, Umbau und Steuern nicht belastbar abgegrenzt.
Die Oberfläche kennzeichnet sie als ungeprüfte Investitionsansätze.
Es gibt keinen zusätzlichen pauschalen Installationsaufschlag von 15 %.
Förderhinweise werden angezeigt, aber nicht von der Investition abgezogen.
Wartung, Ersatz, Finanzierung, Steuern und Degradation sind nicht eingerechnet.

## Verbrauch und Wärmepumpe

Haushaltsstrom = Personen × `consumption.per_person`, sofern nicht überschrieben.
Heizwärmebedarf Q = Fläche × `consumption.heating_per_sqm[Haustyp][Dämmung]`,
sofern nicht überschrieben. Einfamilienhaus nutzt `freistehend`.
Dämmung ist darin bereits enthalten; `insulation_factors` wird nicht erneut angewendet.

Der im Code COP genannte Jahresfaktor dient als vereinfachte Jahresarbeitszahl:
`c = clamp(base_cop × Dämmfaktor × Fußbodenheizungsfaktor, 2.5, 3.5)`.
Dämmfaktor: `factor_good` bei gut, `factor_bad` bei schlecht, sonst 1.
Fußbodenheizungsfaktor: `factor_fbh` falls vorhanden, sonst 1.
Die zuvor ungenutzte Konfiguration 1,15 wurde auf den bisher effektiven
Laufzeitwert 1,1 vereinheitlicht; keine stillschweigende Effizienzsteigerung.
WP-Strom = Q / c; WP-Leistung = Q / `full_load_hours`;
WP-Investition = WP-Leistung × `cost_per_kw`.
Kein 70-%-Zuschlag auf Haushaltsstrom, keine Verdopplung und keine 250 €/m².

Beispiel: 150 m² Reihenhaus, normale Dämmung, keine Fußbodenheizung:
Q = 16.500 kWh/a; c = 3; WP-Strom = 5.500 kWh/a;
Leistung = 8,25 kW; Investitionsansatz = 12.375 €.
Q/2.000 ersetzt keine Heizlastberechnung. Warmwasser und Wirkungsgrad der
bisherigen Gasheizung werden nicht separat modelliert.

## PV- und Speicherdimensionierung

Je Szenario: L = Haushalt + gewählte Klimaanlage + E-Auto + ggf. WP-Strom.
PV-Kandidat = L / `pv.yield_per_kwp`. Dimensionierung und Jahresertrag
verwenden denselben konfigurierten Wert; der feste Divisor 850 entfällt.
Mit Speicher oder WP mindestens 7 kWp, danach begrenzt durch
`floor(Dachfläche / 6)` und Haustyp (Reihenhaus 14, Doppelhaus 18,
Einfamilienhaus 24 kWp), dann Rundung auf 0,1 kWp.
Diese Limits und 6 m²/kWp sind Planungsheuristiken, keine Dachbelegungsplanung.
Ein positiver PV-Nutzerwert wird übernommen und bei Dachüberschreitung markiert;
er wird nicht automatisch auf Dach- oder Haustypgrenze gekappt.

G = PV-kWp × `pv.yield_per_kwp`.
Speicherziel B = `clamp(0.9 × L / 365, 4, 15)` kWh, sonst 0.
Empfohlener und berechneter Speicher S = `min(B, 2 × G / 365)`.
Investition und Energiebilanz verwenden dieselbe Kapazität S.
Dies ist keine Regel „Batterie ≤ 2 × PV-kWp“.
Die ungenutzten `recommended_factor_min/max` sind entfernt.
Bei fehlender PV-Erzeugung wird S = 0; kein nutzloser Speicher wird berechnet.

## Gemeinsame Stundenbilanz für Kennzahlen und Diagramme

Ein synthetisches Nichtschaltjahr mit 8.760 Stunden wird einmal je Szenario
berechnet. Jahreskennzahlen, Monatsdiagramm und Modelltage stammen aus
denselben Energieflüssen. WP, Klima und E-Auto werden genau einmal addiert.
Es gibt keine separaten Chart-Erträge von 1.000 oder 1.050 kWh/kWp und
keine nachträglichen Autarkiekorridore.

Die im Kern explizit hinterlegten Profile sind **ungeprüfte Heuristiken**:

- PV-Monatsgewichte `[3,5,11,13,14,13,12,11,9,6,2.5,1.5]`, auf Summe 1 normiert.
  Monatliche Tageslichtdauer `[8,10,12,14,16,17,16,14,12,10,8,7]` Stunden;
  positiver Cosinusbogen um 12 Uhr, auf Tagesertrag normiert.
- Haushaltsstrom nach normiertem Stundenprofil mit Morgen-/Abendspitzen,
  auf Jahressumme normiert; E-Auto gleichmäßig 18–06 Uhr.
- WP-Monatsgewichte `[18,15,13,8,4,1,1,1,4,9,12,14]`, auf Summe 1 normiert;
  innerhalb eines Tages gleichmäßige Last.
- Klima-Monatsgewichte `[0,0,0,0,1,2,3,3,1,0,0,0]`, normiert;
  innerhalb eines Tages gleichmäßig 12–21 Uhr.

Keine Wetterstreuung, keine realen Messlastgänge, keine Regelung von WP oder
E-Auto. Die neue Konsistenz ist kein Nachweis prognostischer Genauigkeit.
Tagesdiagramme zeigen den 15. Januar und 15. Juli dieses Modelljahres,
mit dem tatsächlichen fortgeschriebenen Modell-Speicherfüllstand.

Stündlich, mit P = PV-Erzeugung und L = Last:

```text
D = min(P, L)                         direkter Verbrauch
C = min(P - D, freie Speicherkapazität) Ladung aus PV
Speicherinhalt += C
A = min(L - D, Speicherinhalt × 0.85)   nutzbare Abgabe
V = A / 0.85 - A                     Speicherverluste
Speicherinhalt -= A / 0.85
E = D + A                            PV-Eigenverbrauch
Netzbezug = L - E
Einspeisung = P - D - C
```

70 % der nominellen Kapazität gelten als nutzbar; 85 % Roundtrip-Wirkungsgrad,
rechnerisch vollständig bei Entladung angesetzt. Keine Lade-/Entladeleistungs-
grenze, kein Standbyverbrauch und keine Netzladung. Diese Vereinfachungen
bleiben Unsicherheiten der Speicherauslegung. Der Speicher startet leer;
Jahresendbestand wird als `storageChange` separat bilanziert, nicht als Verbrauch
oder Einspeisung. Eine stationäre, zyklische Jahresrechnung wird nicht behauptet.

Kontrollgleichungen (auch monatlich, mit jeweiliger Bestandsänderung):

```text
PV = Eigenverbrauch + Einspeisung + Speicherverluste + Speicherbestandsänderung
Last = Eigenverbrauch + Netzbezug
Speicherladung = Speicherabgabe + Verluste + Speicherbestandsänderung
```

Beispiel: 5 kWp, 5 kWh Speicher, 5.000 kWh Last, konfigurierter Ertrag,
keine WP/Klima/EV, Ergebnisse gerundet:

| Kennzahl | Ergebnis |
|---|---:|
| PV-Ertrag | 4.750,00 kWh/a |
| Eigenverbrauch | 3.060,75 kWh/a |
| Netzbezug | 1.939,25 kWh/a |
| Einspeisung | 1.537,41 kWh/a |
| Speicherverluste | 151,84 kWh/a |
| Stromautarkie | 61,22 % |

Die Werte ändern sich bei anderen Lastprofilen. Eine höhere Genauigkeit als
zwei Nachkommastellen wäre angesichts der Annahmen irreführend; intern wird
für Energie- und Kostenrechnung nicht vorzeitig gerundet.

Stromautarkie = 100 × Eigenverbrauch / Stromlast (bei 0 Last: 0).
Der PV-Anteil am WP-Strom wird pro Stunde proportional zu den gleichzeitigen
Lasten zugeordnet. Er ersetzt die frühere irreführende „Heizautarkie 100 %“.
EV-Speicherabgabe wird ebenso anteilig zugeordnet, ohne fiktive zusätzliche Energie.
Der PV-Anteil am Endenergiebezug = Eigenverbrauch / (Stromlast + verbleibendes Gas).
Umweltwärme ist kein Bestandteil dieser Endenergiekennzahl.

## Investition und Wirtschaftlichkeit

PV = kWp × `pv.cost_per_kwp`; Speicher = S × `battery.cost_per_kwh`;
WP wie oben; Gesamt = PV + Speicher + ggf. WP + gewählte Klima-/Wallboxkosten.
Beispiel für vorgegebene 8 kWp und 10 kWh ohne Extras:
7.200 + 7.500 = 14.700 €; mit der Beispiel-WP: 27.075 €.
Das sind Rechenbeispiele mit ungeprüften Ansätzen, keine Angebote.

Baseline = Haushaltsstrom × Strompreis + Q × Gaspreis + ggf. bisherige Kraftstoffkosten.
Nachher = Netzbezug × Strompreis − Einspeisung × Vergütung + verbleibendes Gas × Gaspreis.
Ersparnis = Baseline − Nachher. Bei WP ist verbleibendes Gas 0.
Klimaanlage und E-Auto werden bei Auswahl in allen drei Szenarien berücksichtigt.
Strom- und Gaspreise sind im Formular überschreibbar.

**Einfache Amortisation:** Investition / jährliche Ersparnis, konstante Preise,
keine Folgekosten. Bei Ersparnis ≤ 0 wird keine Amortisation ausgewiesen.
Keine dynamische oder diskontierte Amortisation und kein NPV.

**20-Jahres-Summe:** Für n=0…19 werden die jährlichen Komponenten getrennt summiert:

```text
vermiedene Strombezugskosten × (1 + Stromsteigerung)^n
+ vermiedene Gaskosten × (1 + Gassteigerung)^n
+ vermiedene Kraftstoffkosten (konstant)
+ Einspeiseerlöse (konstante Vergütung)
```

Die Stromkomponente kann negativ sein, wenn z. B. eine WP den Netzstrombezug erhöht.
Kraftstoff- und Vergütungssteigerung sind bewusst 0, kein unbemerkter Strompreisfaktor.
Die Summe ist nominal und nicht abgezinst; Investition wird darin nicht abgezogen.
Wartung, Ersatz, Finanzierung, Förderung, Steuern und Degradation sind nicht enthalten.
Das ist keine vollständige Lebenszykluskostenrechnung.
CO₂-Einsparung über 20 Jahre nutzt konstante Emissionsfaktoren; monetäre
Preissteigerung wird nicht mehr auf physische Emissionsmengen angewendet.
Nachher-Emissionen = tatsächlicher Netzstrombezug × konfigurierter Stromfaktor
+ verbleibendes Gas × Gasfaktor. E-Auto-Strom wird nicht noch einmal separat
als vollständiger Netzbezug angesetzt; seine Last ist bereits in der Stundenbilanz.

## Herkunft, Plausibilität und Pflege der Preise

- Ertrag 950 bereits in Initialkonfiguration `c966fdf`; kein gespeicherter
  standortbezogener PVGIS-Lauf. Plausible Pauschalannahme, kein Standortnachweis.
  PVGIS berücksichtigt Standort, Ausrichtung und Neigung [1].
- Speicherpreis 550 → 750 im automatisierten Commit `f9913d7` (01.08.2026).
  PV-Preis 1.200 → 900 und WP-Preis 1.800 → 1.500 in `71b17f2` (01.09.2026).
  Strompreis 0,35 → 0,42 in `3936f1a` (01.10.2026).
- Der bisherige Updater übernahm Sprachmodellwerte ohne Recherchewerkzeug,
  Quellen-/Stichtagsnachweis oder definierten Kostenumfang bei >20 % Abweichung.
  Diese Schwelle validierte keine Marktpreise. Commitdatum ist kein Erhebungsdatum.
- Die Verbraucherzentrale zeigt größenabhängige Angebotspreise [2].
  900 €/kWp ist als pauschaler Komplettansatz kritisch niedrig; 750 €/kWh
  liegt über dortigen mittleren Paketpreisen. Das begründet keinen verbindlichen
  Ersatzpreis. WP-Kosten pro kW sind ohne Leistungsumfang nicht belastbar.
- Basis-Jahreseffizienz 3 ist als Orientierung vertretbar [3]; feste Faktoren
  und Korridore ersetzen keine Auslegung anhand von Gebäude und Vorlauftemperatur.

**Automatische Preisübernahme ist deaktiviert**, sowohl im Förder-Updater als
auch im Workflow. Der frühere Programmeinstieg `update_price_data()` bleibt
als wirkungslose Kompatibilitätsfunktion erhalten. `fetch_subsidy_prices.py --propose`
liefert ausschließlich ausdrücklich ungeprüfte Vorschläge an stdout; keine Datei
wird geschrieben. Ein Sprachmodellvorschlag ist keine recherchierte Quelle.

Manuelle Änderung über PR: pro geändertem Preis Quellen-URL, Erhebungs-/Angebotsdatum,
Anlagengröße/Region, Leistungsumfang inklusive Montage, Umbau und Steuerbehandlung
angeben. Erst nach Prüfung als validiert kennzeichnen. `assumption_review` in der
Konfiguration hält den derzeit **ungeprüften** Status und ausgeschlossene Kosten fest.
Die dort verlinkten Quellen dienen nur der Plausibilisierung, nicht als Herkunft
oder Freigabe der eingetragenen Einzelpreise.

[1] [EU JRC: PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

[2] [Verbraucherzentrale NRW: Angebotspreise, Stand 28.08.2026](https://www.verbraucherzentrale.nrw/wissen/energie/erneuerbare-energien/was-kostet-eine-photovoltaikanlage-49155)

[3] [Verbraucherzentrale: Wärmepumpe, Stand 14.04.2026](https://www.verbraucherzentrale.de/wissen/energie/heizen-und-warmwasser/waermepumpe-alles-was-sie-wissen-muessen-5439)

## Konsistenzprüfung

`python scripts/check_calculation_docs.py` prüft die Konfigurationstabelle und
Quelltext-Prüfsummen. Erst nach Abgleich von Formeln und Beispielen mit `--write`
erneuern. Die Schranke verlangt Review, beweist aber nicht automatisch die Prosa.
`node --test scripts/test_calculation_docs.cjs` prüft Beispiele, Energieerhaltung,
Grenzfälle, monatliche Summen, Zusatzlasten und getrennte Preissteigerung am echten Kern.
Das bestehende Python-Skript `modernisierung_tests.py` erzeugt eine separate
historische Modellmatrix mit abweichenden Heuristiken; es validiert nicht die Browserlogik.
