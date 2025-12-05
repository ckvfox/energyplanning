import pandas as pd
from collections import Counter

df = pd.read_excel('modernisierung_tests.xlsx')

# Extract all warnings
all_warnings = []
for warnings_str in df['warnings'].dropna():
    for warning in warnings_str.split('; '):
        if warning.strip():
            all_warnings.append(warning.strip())

# Count them
warning_counts = Counter(all_warnings)

print("="*80)
print("WARNUNG-ANALYSE (2768 Warnings in 5832 Tests = 47.4%)")
print("="*80)
print(f"\nTotal unique warning types: {len(warning_counts)}\n")

for warning, count in warning_counts.most_common():
    pct = (count / 5832) * 100
    print(f"{count:4d} ({pct:5.1f}%) - {warning}")

print("\n" + "="*80)
print("INTERPRETATION")
print("="*80)
print("\nBreak-down by scenario:")
for scenario in df['scenario'].unique():
    scenario_df = df[df['scenario'] == scenario]
    scenario_warnings = scenario_df[scenario_df['warnings'].notna()]
    pct = (len(scenario_warnings) / len(scenario_df)) * 100
    print(f"  {scenario:35s} - {pct:5.1f}% ({len(scenario_warnings)}/{len(scenario_df)})")

print("\nBreak-down by houseType:")
for house in df['houseType'].unique():
    house_df = df[df['houseType'] == house]
    house_warnings = house_df[house_df['warnings'].notna()]
    pct = (len(house_warnings) / len(house_df)) * 100
    print(f"  {house:35s} - {pct:5.1f}% ({len(house_warnings)}/{len(house_df)})")
