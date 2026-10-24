"""Offline documentation drift guard; --write requires prior human review."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs/CALCULATIONS.md'
LOCK = ROOT / 'docs/calculation-review.json'
START = '<!-- assumptions:start -->'
END = '<!-- assumptions:end -->'


def expected_table():
    data = json.loads((ROOT / 'data/data.json').read_text())
    rows = ['| Konfigurationspfad | Modellwert |', '|---|---:|']
    for section in ('pv', 'battery', 'heatpump', 'prices', 'inflation'):
        for key, value in data[section].items():
            rows.append(f'| `{section}.{key}` | {value} |')
    return '\n' + '\n'.join(rows) + '\n'


def source_hashes():
    return {
        path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        for path in ('scripts/script.js', 'scripts/calculation-core.js')
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    text = DOC.read_text()
    before, rest = text.split(START)
    current, after = rest.split(END)
    expected = expected_table()
    hashes = source_hashes()
    if args.write:
        DOC.write_text(before + START + expected + END + after)
        LOCK.write_text(json.dumps(hashes, indent=2) + '\n')
        print('Table and source review baseline updated; review formulas and examples before commit.')
        return
    errors = []
    if current != expected:
        errors.append('Configuration table differs from data/data.json.')
    if not LOCK.exists() or json.loads(LOCK.read_text()) != hashes:
        errors.append('Calculation sources changed since documentation review.')
    if errors:
        raise SystemExit('\n'.join(errors) + '\nReview CALCULATIONS.md, then run --write.')
    print('Calculation documentation consistency: OK')


if __name__ == '__main__':
    main()
