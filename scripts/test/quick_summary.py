import pandas as pd
from collections import Counter

df = pd.read_excel('modernisierung_tests.xlsx')
w = df[df['warnings'].notna()]
i = df[df['issues'].notna()]

print("OPTIMIERTE TEST-RESULTATE")
print("="*70)
print(f"Issues: {len(i)}")
print(f"Warnings: {len(w)} ({len(w)/len(df)*100:.1f}%)")
print(f"OK: {len(df)-len(i)-len(w)} ({(len(df)-len(i)-len(w))/len(df)*100:.1f}%)")
print(f"\nTotal: {len(df)}\n")

if len(w) > 0:
    all_warnings = []
    for warnings_str in w['warnings'].dropna():
        for warning in warnings_str.split('; '):
            if warning.strip():
                all_warnings.append(warning.strip())
    
    warning_counts = Counter(all_warnings)
    print("Remaining Warnings:")
    for warning, count in warning_counts.most_common(5):
        pct = (count / len(df)) * 100
        print(f"  {count:3d} ({pct:5.1f}%) - {warning}")

print("\n" + "="*70)
print("ISSUES (sollten nur 6 sein - alle WP+Speicher+Reihenhaus):")
print("="*70)
if len(i) > 0:
    for _, row in i.iterrows():
        print(f"  {row['scenario']:35s} / {row['houseType']:20s}")
