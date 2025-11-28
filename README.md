# 🌱 Energetische Modernisierungs-Rechner (Web-App)

Ein leichter, intuitiver Web-Rechner, der Hausbesitzern eine erste Einschätzung zu Energieverbrauch, Photovoltaik-Bedarf, Wärmepumpen-Dimensionierung sowie zu erwartenden Kosten und Amortisationszeiten ermöglicht. Die App funktioniert vollständig lokal im Browser und benötigt kein Backend.

---

## 🚀 Features

### ✔️ Verbrauchsabschätzung
Basierend auf:
- Haustyp (Reihenhaus / freistehend)
- Wohnfläche (m²)
- Anzahl der Bewohner
- Isolierungsqualität
→ liefert die App eine grobe Verbrauchsprognose für Strom und Heizung.

### ✔️ Modernisierungsoptionen
Einstellbare Maßnahmen:
- Photovoltaik (mit oder ohne Speicher)
- Wärmepumpe (mit oder ohne Fußbodenheizung)
- Klimaanlage als zusätzliche Last
- Bundeslandauswahl für spätere Förderhinweise

### ✔️ Berechnungen
Die App ermittelt:
- geschätzten Strom- und Wärmebedarf
- notwendige PV-Leistung (kWp)
- Speichergröße
- Wärmepumpenlast / COP-Abschätzung
- Kostenranges je Maßnahme
- Amortisation basierend auf Energiepreisen

### ✔️ Saubere Struktur
- `index.html`
- `style.css`
- `scripts/script.js`
- `data/data.json` (Verbrauchswerte, Kostenannahmen, COP-Werte etc.)

Alle Daten werden im Browser gehalten – keine Speicherung auf Servern.

---

## 🛠️ Technologie-Stack
- **HTML5 / CSS3**
- **Vanilla JavaScript**
- **JSON** für Datenbasis und Berechnungsgrundlagen  
- Keine Frameworks oder Backends notwendig

---

## 📊 Datenbasis (vereinfacht)
Die Berechnungen nutzen konservative Orientierungswerte:
- Verbrauch pro m² und pro Person
- Kostenbereiche für PV, Speicher und Wärmepumpen
- COP-Werte und Heizlastfaktoren
- Durchschnittliche Energiepreise (Strom/Gas)

> Hinweis: Der Rechner dient als Orientierungshilfe – kein Ersatz für Fachplanung oder Energieberatung.

---

## 📂 Projektstruktur

/
|-- index.html
|-- style.css
|
|-- scripts/
|   |-- script.js
|
|-- data/
    |-- data.json


---

## 🗺️ Roadmap

### 🔜 Version 1.1
- Verfeinerte Verbrauchswerte nach Gebäudetyp
- Förderhinweise pro Bundesland
- Genauere Kostenmodelle

### 🔜 Version 1.2
- Mobile-Optimierung
- Diagramme der Ergebnisse
- Tooltips & Infos

### 🔜 Version 1.3
- PDF-Export
- Teilen-Links / URL-Parameter

---

## 🤝 Beiträge
Pull Requests sind willkommen – besonders zu:
- verbesserten Verbrauchsdaten
- detaillierteren Kostenmodellen
- Förderlandschaft

---

## 📄 Lizenz
MIT License
