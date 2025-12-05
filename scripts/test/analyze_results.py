#!/usr/bin/env python3
import pandas as pd
import sys

df = pd.read_excel('modernisierung_tests.xlsx', sheet_name='Testmatrix')

print(f"=== TEST RESULTS ANALYSIS ===\n")
print(f"Total test cases: {len(df)}")
print(f"Columns: {len(df.columns)}")

# Issues
issues_df = df[df['issues'].notna()]
print(f"\n=== ISSUES ({len(issues_df)} Fälle) ===")
if len(issues_df) > 0:
    for idx, row in issues_df.iterrows():
        print(f"\n[Row {idx}] {row['scenario']}")
        print(f"  Input: {row['houseType']}, {row['area']}m², {int(row['people'])} people, {row['insulation']}")
        print(f"  DachArea: {row['roofArea']}m², Climate: {row['climate']}, Wallbox: {row['wallbox']}")
        print(f"  Issue: {row['issues']}")
        print(f"  Status: {row['status']}")
else:
    print("  ✓ Keine Issues gefunden!")

# Warnings
warnings_df = df[df['warnings'].notna()]
print(f"\n=== WARNINGS ({len(warnings_df)} Fälle) ===")
if len(warnings_df) > 0:
    samples = warnings_df.head(3)
    for idx, row in samples.iterrows():
        print(f"\n[Row {idx}] {row['scenario']}")
        print(f"  Warning: {row['warnings']}")
else:
    print("  ✓ Keine Warnings!")

# Scenario distribution
print(f"\n=== SCENARIO DISTRIBUTION ===")
print(df['scenario'].value_counts())

# Check for NaN in critical columns
print(f"\n=== NaN CHECK ===")
critical_cols = ['pv_kwp', 'battery_kwh', 'grid_import', 'feed_in', 'autarky_pct']
for col in critical_cols:
    nan_count = df[col].isna().sum()
    if nan_count > 0:
        print(f"  {col}: {nan_count} NaN values ⚠️")
    else:
        print(f"  {col}: ✓ OK")

print(f"\n=== SUMMARY ===")
print(f"Status: {'✓ ALL TESTS PASSED' if len(issues_df) == 0 else '✗ ISSUES FOUND'}")
