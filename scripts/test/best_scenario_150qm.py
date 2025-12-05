import pandas as pd

df = pd.read_excel('modernisierung_tests.xlsx')

# Filter für: Reihenhaus, 140qm, 3 Personen, normal, keine FBH, keine Wallbox, mit Klima
filtered = df[
    (df['houseType'] == 'reihenhaus') &
    (df['area'] == 150) &  # Nächster Wert zu 140 im Test-Matrix
    (df['people'] == 3) &
    (df['insulation'] == 'normal') &
    (df['floorHeating'] == False) &
    (df['wallbox'] == False) &
    (df['climate'] == True)
]

print("="*80)
print("ANALYSE: Reihenhaus 150qm (nächster zu 140qm), 3 Personen, normale Isolierung")
print("         Klimaanlage, keine Wallbox")
print("="*80)
print(f"\nGefunden: {len(filtered)} Szenarien\n")

# Sortiere nach Break-Even (wirtschaftlichste zuerst)
filtered_sorted = filtered.dropna(subset=['break_even_years']).sort_values('break_even_years')

if len(filtered_sorted) > 0:
    for i, (idx, row) in enumerate(filtered_sorted.head(5).iterrows(), 1):
        print(f"\n{'='*80}")
        print(f"PLATZ {i}: {row['scenario']}")
        print(f"{'='*80}")
        print(f"Break-even: {row['break_even_years']:.1f} Jahre")
        print(f"Investition: €{row['total_cost']:,.0f}")
        print(f"Jährliche Kosten danach: €{row['annual_cost_post']:,.0f}/a")
        print(f"\nTechnik:")
        print(f"  PV: {row['pv_kwp']}kWp")
        print(f"  Speicher: {row['battery_kwh']}kWh")
        if 'Wärmepumpe' in row['scenario']:
            print(f"  Wärmepumpe: Ja")
        print(f"\nEnergiefluss:")
        print(f"  Autarkie: {row['autarky_pct']:.1f}%")
        print(f"  PV-Erzeugung: {row['pv_generation']:.0f}kWh/a")
        print(f"  Netzbezug: {row['grid_import']:.0f}kWh/a")
        print(f"  Einspeisung: {row['feed_in']:.0f}kWh/a")
        print(f"\nUmwelt:")
        print(f"  CO2-Einsparung: {row['co2_saving']:.0f}kg/a")
        print(f"\nStatus: {row['status'].upper()}")

else:
    print("Keine Szenarien gefunden für diese Konfiguration!")
    
print("\n" + "="*80)
