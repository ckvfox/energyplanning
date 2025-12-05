import pandas as pd

df = pd.read_excel('modernisierung_tests.xlsx')

# Filter für: Reihenhaus, 3 Personen, normal, keine FBH, keine Wallbox, mit Klima
filtered = df[
    (df['houseType'] == 'reihenhaus') &
    (df['people'] == 3) &
    (df['insulation'] == 'normal') &
    (df['floorHeating'] == False) &
    (df['wallbox'] == False) &
    (df['climate'] == True)
]

print("="*80)
print("ANALYSE: Reihenhaus 3 Personen, normale Isolierung, Klimaanlage, keine Wallbox")
print("="*80)
print(f"\nGefunden: {len(filtered)} Szenarien\n")

# Sortiere nach Break-Even (wirtschaftlichste zuerst)
filtered_sorted = filtered.dropna(subset=['break_even_years']).sort_values('break_even_years')

if len(filtered_sorted) > 0:
    for i, (idx, row) in enumerate(filtered_sorted.head(10).iterrows(), 1):
        print(f"\n{i}. {row['scenario']}")
        print(f"   Break-even: {row['break_even_years']:.1f} Jahre")
        print(f"   Investition: €{row['total_cost']:,.0f}")
        print(f"   Jährliche Kosten danach: €{row['annual_cost_post']:,.0f}/a")
        print(f"   PV: {row['pv_kwp']}kWp, Speicher: {row['battery_kwh']}kWh")
        print(f"   Autarkie: {row['autarky_pct']:.1f}%")
        print(f"   CO2-Einsparung: {row['co2_saving']:.0f}kg/a")
        print(f"   Status: {row['status']}")
        if row['issues']:
            print(f"   ⚠️  Issues: {row['issues']}")
        if row['warnings']:
            print(f"   ℹ️  Warnings: {row['warnings']}")

else:
    print("Keine Szenarien ohne Fehler gefunden!")
    
print("\n" + "="*80)
