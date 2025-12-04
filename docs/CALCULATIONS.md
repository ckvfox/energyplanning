# Berechnungsformeln & Algorithmen - Energy Calculator

## 📐 Energiebilanzen-Modell

### **Grundlegende Annahmen**

```json
{
  "pvYieldPerKwp": 850,          // kWh/kWp/Jahr (Durchschnitt DE)
  "batteryRoundtripEff": 0.85,   // 85% Speicher-Wirkungsgrad
  "directSelfConsumptionRate": 0.35,  // Ohne Batterie: 35%
  "withBatteryRate": 0.45        // Mit Batterie: 45%
}
```

---

## 🔋 Energie-Berechnung (estimateEnergyBalance)

### **Input-Parameter**
```javascript
{
  pvKwp,              // Installierte PV-Leistung [kWp]
  batteryKwh,         // Speicherkapazität [kWh]
  annualLoadKwh,      // Jährlicher Stromverbrauch [kWh]
  pvYieldPerKwp,      // Spezifischer Ertrag [kWh/kWp]
  hasHeatpump,        // Boolean: Wärmepumpe vorhanden?
  hasEv,              // Boolean: E-Auto vorhanden?
  evLoadKwh           // E-Auto Jahresverbrauch [kWh]
}
```

### **Berechnungsschritte**

#### **Schritt 1: PV-Ertrag**
```
PV_Generation = PV_kWp × PV_Yield_Per_kWp

Beispiel: 5 kWp × 850 kWh/kWp = 4.250 kWh/Jahr
```

#### **Schritt 2: Direkte Eigennutzung (ohne Speicher)**
```
directSelfConsumption_Rate = hasHeatpump ? 0.35 : 0.35
                            (Mit Batterie: 0.45)

directSelf = min(
    annualLoad_kWh × directSelfConsumption_Rate,
    PV_Generation × 0.9
)

Beispiel:
- annualLoad = 5.000 kWh
- directSelf = min(5000 × 0.35, 4250 × 0.9)
            = min(1750, 3825)
            = 1.750 kWh
```

#### **Schritt 3: PV-Überschuss**
```
PV_Surplus = max(PV_Generation - directSelf, 0)

Beispiel: 4250 - 1750 = 2.500 kWh
```

#### **Schritt 4: Batterieeinspeisung**
```
IF Battery_kWh > 0:
    dailyUsable = Battery_kWh × 0.7  // 70% usable capacity
    annualUsable_PV = dailyUsable × 365
    pvForBattery = min(PV_Surplus, annualUsable_PV)
    
    batteryDelivered = pvForBattery × roundtripEff
ELSE:
    batteryDelivered = 0

Beispiel mit 5 kWh Batterie:
- dailyUsable = 5 × 0.7 = 3,5 kWh
- annualUsable_PV = 3,5 × 365 = 1.277,5 kWh
- pvForBattery = min(2500, 1277,5) = 1.277,5 kWh
- batteryDelivered = 1277,5 × 0.85 = 1.085,9 kWh
```

#### **Schritt 5: Gesamte Eigennutzung**
```
selfUse = min(annualLoad_kWh, directSelf + batteryDelivered)

Beispiel: min(5000, 1750 + 1085,9) = min(5000, 2835,9)
        = 2.835,9 kWh
```

#### **Schritt 6: Netzeinspeisung & Netzbezug**
```
feedIn = max(PV_Generation - selfUse, 0)
gridImport = max(annualLoad_kWh - selfUse, 0)

Beispiel:
- feedIn = max(4250 - 2835,9, 0) = 1.414,1 kWh
- gridImport = max(5000 - 2835,9, 0) = 2.164,1 kWh

Kontrolle: gridImport + selfUse = 2164,1 + 2835,9 = 5000 ✓
```

#### **Schritt 7: Autarkie-Quote**
```
autarky = (selfUse / annualLoad_kWh) × 100  [%]

Beispiel: (2835,9 / 5000) × 100 = 56,7%
```

#### **Schritt 8: E-Auto-Betankung (optional)**
```
IF hasEv AND Battery_kWh > 0:
    evFromBattery = min(evLoad_kWh × 0.5, batteryDelivered × 0.4)
ELSE:
    evFromBattery = 0

Beispiel mit 3000 kWh E-Auto-Bedarf:
- evFromBattery = min(3000 × 0.5, 1085,9 × 0.4)
                = min(1500, 434,4)
                = 434,4 kWh
```

---

## 🏠 Dimensionierungsalgorithmen

### **PV-Größe (roofPvLimit)**

#### **Dachfläche → maximale PV-Leistung**
```
Annahme: 7 m² pro kWp (basierend auf durchschnittliche 
         Modulgröße ~400W, ca. 2 m² pro kWp)

maxPV_kWp = floor(roofArea_m2 / 7)

Beispiel: 100 m² Dachfläche → max. 14 kWp
```

#### **Optimale PV-Größe nach Haustyp**
```
Regelwerk aus data.json:

Reihenhaus:
  - Min: 4 kWp
  - Target: 6-8 kWp (600% des Grundverbrauchs)
  - Max: 14 kWp (Dachfläche)

Doppelhaus:
  - Min: 5 kWp
  - Target: 8-10 kWp
  - Max: 18 kWp

Einfamilienhaus:
  - Min: 6 kWp
  - Target: 10-12 kWp
  - Max: 24 kWp
```

#### **PV-Berechnung aus Verbrauch**
```
basePV_kWp = max(
    min_kWp,
    min(floor(annualLoad / 850), max_kWp)
)

Beispiel (Einfamilienhaus, 5000 kWh):
- basePV = max(6, min(floor(5000/850), 24))
         = max(6, min(5, 24))
         = max(6, 5)
         = 6 kWp
```

### **Batterie-Größe**

#### **Berechnung aus Tagesverbrauch**
```
dailyLoad_kWh = annualLoad_kWh / 365
targetBattery_kWh = dailyLoad_kWh × 0.9

Limitierung:
battery_kWh = clamp(targetBattery_kWh, 4, 15)

Beispiel (5000 kWh/Jahr):
- dailyLoad = 5000 / 365 = 13,7 kWh
- targetBattery = 13,7 × 0.9 = 12,3 kWh
- battery = clamp(12,3, 4, 15) = 12,3 kWh
```

#### **Regel: Batterie ≤ 2 × PV in kWh**
```
IF battery_kWh > pvSize_kWp × 2:
    battery_kWh = pvSize_kWp × 2
    WARN: "Batterie begrenzt: nicht wirtschaftlich"
```

### **Wärmepumpen-Auslegung**

#### **Zusätzlicher Stromverbrauch**
```
baseDemand = annualLoad_kWh

IF hasHeatpump:
    heatpumpDemand = floor(baseDemand × 0.7)  // 70% Stromzuschlag
    totalDemand = baseDemand + heatpumpDemand
ELSE:
    totalDemand = baseDemand

Beispiel (5000 kWh → mit WP):
- heatpumpDemand = floor(5000 × 0.7) = 3.500 kWh
- totalDemand = 5000 + 3500 = 8.500 kWh
```

---

## 💰 Kostenberechnungen

### **Investitionskosten**

#### **PV-System**
```
Cost_PV = pvSize_kWp × 1.600 €/kWp   (data.json)

Beispiel: 8 kWp × 1600 = 12.800 €
```

#### **Speichersystem**
```
Cost_Battery = batterySize_kWh × 550 €/kWh   (data.json)

Beispiel: 10 kWh × 550 = 5.500 €
```

#### **Wärmepumpe**
```
Cost_Heatpump = 
  IF hasHeatpump:
    floorArea_m2 × 250 €/m2   (data.json)
  ELSE:
    0 €

Beispiel (150 m²): 150 × 250 = 37.500 €
```

#### **Installationskosten**
```
Cost_Installation = (Cost_PV + Cost_Battery + Cost_HP) × 0.15

Beispiel: (12800 + 5500 + 37500) × 0.15 = 8.925 €
```

#### **Gesamtinvestition**
```
Total_Cost = Cost_PV + Cost_Battery + Cost_HP + Cost_Installation

Beispiel: 12800 + 5500 + 37500 + 8925 = 64.725 €
```

### **Jährliche Kostenersparnisse**

#### **Strombezugspreis**
```
gridPrice_€ = data.json["assumptions"]["gridPrice"]  // €/kWh

Beispiel: 0,35 €/kWh
```

#### **Eigenverbrauch-Einsparung**
```
savingsSelfUse = selfUse_kWh × gridPrice_€/kWh

Beispiel: 2835,9 × 0,35 = 992,6 €/Jahr
```

#### **Einspeiseerlös**
```
feedInPrice_€ = data.json["assumptions"]["feedInPrice"]  // €/kWh

incomeFromFeedin = feedIn_kWh × feedInPrice_€/kWh

Beispiel: 1414,1 × 0,08 = 113,1 €/Jahr
```

#### **Gesamtjährliche Einsparung**
```
totalSavings = savingsSelfUse + incomeFromFeedin

Beispiel: 992,6 + 113,1 = 1.105,7 €/Jahr
```

### **Break-Even & Amortisation**

#### **Einfache Amortisationszeit**
```
simplePaybackYears = Total_Cost / totalSavings

Beispiel: 64.725 / 1105,7 = 58,5 Jahre

HINWEIS: Sehr lang! Grund: Wärmepumpen-Kosten
         Ohne WP: 20.300 / 892 = 22,8 Jahre
```

#### **NPV mit Zinsrate**
```
NPV = -Total_Cost + Σ(savings_year_t / (1 + i)^t)

Wobei:
- i = Diskontrate (z.B. 2,5% = 0,025)
- t = Jahr (1 bis 25)

Beispiel vereinfacht (ohne exakte Kalkulation):
- Bei 25 Jahren: Σ ≈ 27.642 €
- NPV @ 2,5% = -64.725 + 27.642 = -37.083 € (negativ)
```

---

## 📊 Tages- & Jahresganglinien

### **Monatliche PV-Erzeugung (monthlyPVFactors)**
```javascript
[0.03, 0.05, 0.11, 0.13, 0.14, 0.13, 0.12, 0.11, 0.09, 0.06, 0.025, 0.015]
//J    F    M    A    M    J    J    A    S    O    N      D

monthlyGeneration = annualGeneration × monthlyFactor[month]

Beispiel (4250 kWh/Jahr):
- Januar: 4250 × 0.03 = 127,5 kWh
- Juli: 4250 × 0.14 = 595 kWh
```

### **Täglicher PV-Verlauf (dailyPVShape - Sommertag)**
```javascript
[0,0,0,0, 0.05,0.15,0.30,0.55,0.75,0.95,1.0,1.0,
 0.95,0.85,0.65,0.45,0.25,0.12,0.05,0,0,0,0,0]
//0h  2h 4h  6h  8h  10h 12h 14h 16h 18h 20h 22h

dailyValue_t = monthlyGeneration × dailyPVShape[hour]

Beispiel Sommertag Juli (19,84 kWh für diesen Tag):
- 08:00: 19,84 × 0.55 = 10,9 kWh
- 12:00: 19,84 × 1.0 = 19,84 kWh (Peak)
- 16:00: 19,84 × 0.65 = 12,9 kWh
```

### **Täglicher Stromverbrauch (saisonal)**
```
Sommertag (Juni-August):
  dailyLoad = annualLoad / 365 × 0.85  (15% weniger)

Wintertag (Dezember-Februar):
  dailyLoad = annualLoad / 365 × 1.15  (+15% mehr)

Übergangstag (März, September-November):
  dailyLoad = annualLoad / 365

Beispiel (5000 kWh/Jahr):
- Sommertag: 13,7 × 0,85 = 11,6 kWh
- Wintertag: 13,7 × 1,15 = 15,8 kWh
- Übergangstag: 13,7 kWh
```

---

## 🎯 Szenario-Logik (chartScenarioIndex)

### **Szenario 0: Nur PV (ohne Speicher)**
```
- Battery_kWh = 0
- hasHeatpump = false
- Berechnung: nur directSelf + gridImport

Autarkie: niedrig (30-40% typisch)
```

### **Szenario 1: PV + Speicher**
```
- Battery_kWh = berechnete Größe
- hasHeatpump = false
- Berechnung: directSelf + batteryDelivered

Autarkie: mittel (50-70% typisch)
```

### **Szenario 2: PV + Speicher + Wärmepumpe**
```
- Battery_kWh = berechnete Größe
- hasHeatpump = true
- annualLoad verdoppelt sich (Gas → Strom)
- Berechnung: mit erhöhtem Verbrauch

Autarkie: niedrig (20-40% wegen höherer Last)
```

---

## ⚠️ Edge Cases & Validierungen

### **Grenzbedingungen**

```javascript
// Negativer Verbrauch
IF annualLoad_kWh < 0:
    WARN: "Verbrauch kann nicht negativ sein"
    annualLoad_kWh = 0

// PV größer als Dachfläche
IF pvSize > roofPvLimit(roofArea):
    WARN: "PV größer als Dachfläche möglich"
    pvSize = roofPvLimit(roofArea)

// Batterie > 2× PV
IF battery > pvSize × 2:
    WARN: "Batterie unwirtschaftlich groß"
    battery = pvSize × 2

// Autarkie über 100%
IF autarky > 100:
    autarky = 100

// Sehr kleine Werte
IF batteryDelivered < 0.1:
    batteryDelivered = 0
```

---

## 📈 Variationen & Szenarien

### **Best Case (hohe Autarkie)**
```
Input:
- Large PV: 15 kWp
- Large Battery: 15 kWh
- Low Load: 3000 kWh
- No Heatpump

Result:
- Autarky: 85-95%
- Break-even: 15-18 Jahre
```

### **Realistic Case (mittlere Autarkie)**
```
Input:
- Medium PV: 8 kWp
- Medium Battery: 8 kWh
- Medium Load: 5000 kWh
- No Heatpump

Result:
- Autarky: 55-65%
- Break-even: 22-25 Jahre
```

### **Conservative Case (niedrige Autarkie)**
```
Input:
- Small PV: 5 kWp
- Small Battery: 4 kWh
- High Load: 6000 kWh
- With Heatpump

Result:
- Autarky: 20-35%
- Break-even: 35+ Jahre
- Wirtschaftlichkeit fragwürdig
```

---

## 🔍 Quellenangaben & Annahmen

| Parameter | Wert | Quelle |
|-----------|------|--------|
| PV Ertrag | 850 kWh/kWp | Durchschnitt DE (PVGIS) |
| Batterie Wirkungsgrad | 85% | Li-Ion Standard |
| Installationskosten | +15% | Handwerk DE (2024) |
| Strompreis | 0,35 €/kWh | Durchschnitt DE |
| Einspeisevergütung | 0,08 €/kWh | aktuell 2024 |
| Nutzungsdauer | 25 Jahre | PV Module Garantie |

---

## 🚀 Erweiterungsmöglichkeiten

- [ ] Regional unterschiedliche PV-Erträge (North/South DE)
- [ ] Jahreszeit-abhängige Strompreise
- [ ] Degradation von PV-Modulen (~0,5%/Jahr)
- [ ] Batteriealteration (~2-3%/Jahr)
- [ ] Finanzierungsmodelle (Kredit, Leasing)
- [ ] Steuerliche Förderungen differenziert
