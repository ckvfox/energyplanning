# Berechnungsgrundlagen und Modellgrenzen

Prüfstand: 24.10.2026. Referenz: `data/data.json`, `scripts/script.js` und
`scripts/calculation-core.js`. Beschreibung des Ist-Zustands, keine Bestätigung
seiner fachlichen Genauigkeit. Rechenlogik und Konfiguration wurden in diesem
Dokumentationsabgleich nicht geändert.

## Konfigurierte Annahmen

<!-- assumptions:start -->
| Konfigurationspfad | Modellwert |
|---|---:|
| `pv.yield_per_kwp` | 950 |
| `pv.cost_per_kwp` | 900 |
| `battery.recommended_factor_min` | 0.6 |
| `battery.recommended_factor_max` | 0.8 |
| `battery.cost_per_kwh` | 750 |
| `heatpump.base_cop` | 3.0 |
| `heatpump.factor_good` | 1.2 |
| `heatpump.factor_bad` | 0.9 |
| `heatpump.factor_fbh` | 1.15 |
| `heatpump.cost_per_kw` | 1500 |
| `heatpump.full_load_hours` | 2000 |
| `prices.electricity_eur_per_kwh` | 0.42 |
| `prices.gas_eur_per_kwh` | 0.12 |
| `prices.feed_in_eur_per_kwh` | 0.08 |
| `inflation.electricity_rate` | 0.02 |
| `inflation.gas_rate` | 0.03 |
<!-- assumptions:end -->

Alle Werte sind Modellannahmen. Kostenumfang (Gerät, Montage, Elektroarbeiten,
Umbau, Steuern) ist für PV, Speicher und Wärmepumpe nicht belastbar abgegrenzt.
Es gibt keinen zusätzlichen pauschalen Installationsaufschlag von 15 %.
Förderhinweise werden angezeigt, aber nicht von der Investition abgezogen.
Wartung, Ersatz, Finanzierung, Diskontierung und Degradation fehlen in der
Wirtschaftlichkeitsrechnung. Strom- und Gaspreis können im Formular überschrieben werden.

## Verbrauch und Wärmepumpe

Haushaltsstrom = Personen × `consumption.per_person`, sofern nicht überschrieben.
Heizwärmebedarf Q = Fläche × `consumption.heating_per_sqm[Haustyp][Dämmung]`,
sofern nicht überschrieben. Einfamilienhaus nutzt den Schlüssel `freistehend`.
Dämmung ist darin bereits enthalten; `insulation_factors` wird hier nicht erneut angewendet.

Der als COP benannte Jahresfaktor wird wie eine vereinfachte Jahresarbeitszahl benutzt:
`c = clamp(base_cop × Dämmfaktor × Fußbodenheizungsfaktor, 2.5, 3.5)`.
Dämmfaktor: `factor_good` bei gut, `factor_bad` bei schlecht, sonst 1.
Fußbodenheizung: fest **1.1**, sonst 1; `heatpump.factor_fbh` wird nicht verwendet.
WP-Strom = Q / c; WP-Leistung = Q / `full_load_hours`;
WP-Investition = WP-Leistung × `cost_per_kw`.
Kein 70-%-Zuschlag auf Haushaltsstrom, keine Verdopplung und keine 250 €/m².

Beispiel: 150 m² Reihenhaus, normale Dämmung, keine Fußbodenheizung:
Q = 150 × 110 = 16.500 kWh/a; c = 3; WP-Strom = 5.500 kWh/a;
Leistung = 8,25 kW; Investition = 12.375 €. Das ist keine Heizlastberechnung
und kein belegter Komplettpreis für einen Heizungstausch. Warmwasser und
Wirkungsgrad der bisherigen Gasheizung sind nicht separat modelliert.

## PV- und Speicherdimensionierung

Je Szenario: L = Haushalt + gewählte Klimaanlage + E-Auto + ggf. WP-Strom.
PV-Kandidat = L / **850** (fest codierte Dimensionierungsheuristik).
Mit Speicher oder WP mindestens 7 kWp, anschließend begrenzt durch
`floor(Dachfläche / 6)` und Haustyp (Reihenhaus 14, Doppelhaus 18,
Einfamilienhaus 24 kWp), dann Rundung auf 0,1 kWp.
Ein positiver Nutzer-Override wird übernommen und bei Dachüberschreitung markiert;
er wird nicht automatisch auf Dach- oder Haustypgrenze gekappt.
Die Hilfsfunktion `roofPvLimit` rechnet dagegen mit 7 m²/kWp; sie ist
nicht die Dachbegrenzung im aktuellen Szenariopfad.

**850 für die Dimensionierung ist nicht der konfigurierte Jahresertrag.**
Jahresertrag G = PV-kWp × `pv.yield_per_kwp`.
Die beabsichtigte fachliche Begründung dieser unterschiedlichen Werte ist unbelegt.

Speicherempfehlung B = `clamp(0.9 × L / 365, 4, 15)` kWh, sonst 0.
In der Energiebilanz verwendete Kapazität S = `min(B, 2 × G / 365)`.
Dies ist keine Regel „Batterie ≤ 2 × PV-kWp“.
Investition verwendet **B**, nicht S. `recommended_factor_min/max` werden
hier nicht verwendet. Die Kapazitätsbegrenzung ist eine Heuristik, keine
zeitaufgelöste Auslegung anhand von Last und PV-Produktion.

## Jahresenergiebilanz im Berechnungskern

```text
G = max(0, PV-kWp) × konfigurierter Ertrag
D = min(L × (S > 0 ? 0.45 : 0.35), G × 0.9)
U = max(G - D, 0)
Batterieabgabe = S > 0 ? min(U, S × 0.7 × 365) × 0.85 : 0
Eigenverbrauch E = min(L, D + Batterieabgabe)
Netzbezug = max(L - E, 0)
Einspeisung (aktuell) = max(G - E, 0)
Autarkie im Kern = L > 0 ? 100 × E / L : 0
EV aus Batterie = round(min(EV-Last × 0.5, Batterieabgabe × 0.4))
                 nur bei E-Auto und S > 0, sonst 0
```

Beispiel (vorgegebene 5 kWp, S = 5 kWh, L = 5.000 kWh/a):
G = 4.750; D = 2.250; U = 2.500; Batterieabgabe = 1.085,875;
E = 3.335,875; Netzbezug = 1.664,125; aktuelle Einspeisung = 1.414,125 kWh/a;
Kernautarkie = 66,7175 %. Ohne Speicher: E = 1.750 kWh/a.

**Nachgewiesene fachliche Grenze:** Die aktuelle Einspeiseformel zählt
Speicherverluste als Einspeisung. Im Beispiel fehlen 191,625 kWh Verluste in
der PV-Bilanz; ohne Lastbegrenzung wäre die Einspeisung 1.222,5 kWh/a.
Bei Lastbegrenzung muss zusätzlich die tatsächlich benötigte Batterieladung
bestimmt werden. Eine Korrektur benötigt zusammenhängende Energiefluss- und
Kostenregressionstests; sie ist nicht Bestandteil dieses Dokumentationsabgleichs.

Die Anzeige begrenzt die Kernautarkie zusätzlich: zunächst 5–90 %, dann
nur PV 25–40 %, PV+Speicher 50–75 %, mit WP 70–85 %, anschließend gerundet.
Damit kann die angezeigte Autarkie dem Netzbezug widersprechen.
„Heizautarkie 100 %“ bei WP bedeutet im Code nur Gasablösung, keine
Unabhängigkeit vom Stromnetz. Diese Anzeigen sind kein physikalischer Nachweis.

## Investition und Wirtschaftlichkeit

PV-Kosten = kWp × `pv.cost_per_kwp`; Speicherkosten = B × `battery.cost_per_kwh`.
Gesamt = PV + Speicher + ggf. WP + gewählte Klima-/Wallboxkosten.
Beispiel: 8 kWp und 10 kWh ohne Extras: 7.200 + 7.500 = 14.700 €;
mit der oben berechneten WP: 27.075 €. Kein Installationsaufschlag.

Baseline = Haushaltsstrom × Strompreis + Q × Gaspreis + ggf. bisherige Kraftstoffkosten.
Nachher = gerundeter Netzbezug × Strompreis − gerundete Einspeisung × Vergütung
+ verbleibender Gasbedarf × Gaspreis. Ersparnis = Baseline − Nachher.
Bei WP ist verbleibender Gasbedarf 0. E-Auto und Klima werden in allen drei
Szenarien berücksichtigt, wenn gewählt.

Der angezeigte Wert `breakEvenDynamic` ist tatsächlich **einfache Amortisation**:
Investition / jährliche Ersparnis, bei nichtpositiver Ersparnis null.
Die Funktion `calculateBreakEvenDynamic` mit kumulierter Preissteigerung
ist nicht die hierfür verwendete Berechnung. NPV wird nicht berechnet.
20-Jahres-Ersparnis = Summe für n=0…19 von Ersparnis × (1+Stromsteigerung)^n.
Dabei wird auch ein etwaiger Gas-/Kraftstoffanteil mit dem Stromfaktor gesteigert;
der konfigurierte Gassteigerungsfaktor wird hier nicht angewendet.

## Diagramme sind separate Näherungen

`updateChartsForScenario` nutzt `simulateYear` und `simulateDay`.
`simulateYear` rechnet mit fest 1.000 kWh/kWp, monatlichen Faktoren und
Eigenverbrauchsanteilen 0,75/0,35. Der übergebene Haushaltswert enthält bereits
alle Szenariolasten; WP und Klima werden zusätzlich modelliert. Damit sind
Diagramme nicht mit der Jahresbilanz abgestimmt. Die Tageskurve ist eine
heuristische Stundenform, keine normierte stündliche Jahressimulation.
`generateScenarioCurves` enthält wiederum 1.000 × 1,05 als PV-Faktor, wird aber
von diesem Chartpfad nicht genutzt. Frühere tägliche/monatliche Beispielkurven
und pauschale Best-/Realistic-/Conservative-Case-Ergebnisse sind entfernt,
weil sie keine reproduzierbaren Ergebnisse der aktuellen Szenarien waren.

## Herkunft und Plausibilität (24.10.2026)

- PV-Ertrag 950 bereits in Initialkonfiguration `c966fdf`; kein gespeicherter
  standortbezogener PVGIS-Lauf. Plausible Pauschalannahme, kein Deutschland-
  oder Standortnachweis. PVGIS berücksichtigt Standort, Ausrichtung und Neigung [1].
- Speicherpreis 550 → 750 im automatisierten Commit `f9913d7` (01.08.2026).
  PV-Preis 1.200 → 900 und WP-Preis 1.800 → 1.500 im automatisierten Commit
  `71b17f2` (01.09.2026). Strompreis 0,35 → 0,42 in `3936f1a` (01.10.2026).
- Der Preis-Updater fragt ein Sprachmodell nach Durchschnittswerten ohne
  aktiviertes Recherchewerkzeug und ohne Quellen-/Stichtagsnachweis je Wert.
  Abweichungen über 20 % werden übernommen; diese Schwelle validiert keine
  Marktpreise. Commitdatum ist kein Erhebungsdatum. Keine belastbare Herkunft
  für Leistungsumfang und Preisqualität der aktuellen Ansätze.
- Verbraucherzentrale NRW zeigt größenabhängige Angebotspreise [2].
  900 €/kWp ist als pauschaler Komplettansatz kritisch niedrig; 750 €/kWh
  liegt über den dortigen mittleren Paketpreisen. Daraus folgt weder ein
  verbindlicher Ersatzpreis noch, dass ein Einzelangebot falsch ist.
- Jahres-WP-Effizienz muss als JAZ verstanden werden [3]. Basis 3 ist als
  Orientierung vertretbar; feste Gebäudefaktoren und der Korridor 2,5–3,5
  sind keine Fachplanung. 1.500 €/kW ist ohne definierten Umfang kein
  belastbarer Komplettkostenansatz. Q/2.000 ersetzt keine Heizlastberechnung.

[1] [EU JRC: PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

[2] [Verbraucherzentrale NRW: PV- und Speicher-Angebotspreise, Stand 28.08.2026](https://www.verbraucherzentrale.nrw/wissen/energie/erneuerbare-energien/was-kostet-eine-photovoltaikanlage-49155)

[3] [Verbraucherzentrale: Wärmepumpe, Stand 14.04.2026](https://www.verbraucherzentrale.de/wissen/energie/heizen-und-warmwasser/waermepumpe-alles-was-sie-wissen-muessen-5439)

## Konsistenzprüfung und Pflege

`python scripts/check_calculation_docs.py` vergleicht die generierte Tabelle
mit allen skalaren PV-, Speicher-, WP-, Preis- und Inflationswerten sowie den
Prüfstand der beiden Berechnungsdateien. Änderungen lassen CI fehlschlagen.
Nach fachlichem Abgleich aller betroffenen Formeln und Beispiele kann
`--write` Tabelle und Prüfstand erneuern. Der Quelltext-Prüfstand ist bewusst
konservativ: auch reine UI-Änderungen in script.js erfordern eine Bestätigung.
Dies ist eine Review-Schranke, kein automatischer Beweis der Prosa-Richtigkeit.
Die Node-Tests führen den echten Berechnungskern aus und prüfen das Beispiel.
Das bestehende Python-Skript modernisierung_tests.py erzeugt dagegen eine
separate Modellmatrix mit abweichenden Heuristiken (u. a. 7 m²/kWp und
anderen Haustypgrenzen); es ist kein Nachweis der Browser-Rechenlogik.
