"""Offline structural gate; does not replace human verification of source content."""
import json
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
MEASURES = {'pv', 'battery', 'heatpump', 'heating_optimization', 'building_envelope'}
KINDS = {'Förderkredit', 'Direkter Zuschuss', 'Steuerliche Vergünstigung', 'Förderkredit mit Tilgungszuschuss'}
HOSTS = {'www.kfw.de', 'www.bafa.de', 'www.nrwbank.de', 'www.foerderdatenbank.de',
         'www.bundesfinanzministerium.de', 'lsth.bundesfinanzministerium.de', 'www.energiewechsel.de'}


def official_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return (parsed.scheme == 'https' and parsed.netloc in HOSTS
            and len(parsed.path.strip('/').split('/')) >= 3)


def validate(data):
    if not isinstance(data, dict) or 'NW' not in data:
        raise ValueError('Missing state data')
    for state, measures in data.items():
        if not isinstance(measures, dict) or set(measures) != MEASURES:
            raise ValueError(f'Invalid categories: {state}')
        identities = {}
        for entries in measures.values():
            if not isinstance(entries, list):
                raise TypeError('Entries must be a list')
            seen = set()
            for entry in entries:
                if not isinstance(entry, dict) or any(not isinstance(entry.get(k), str) or not entry[k].strip()
                                                     for k in ('title', 'description', 'type', 'link_portal')):
                    raise ValueError('Missing entry fields')
                status = entry.get('verification_status')
                if status != 'reviewed':
                    if state == 'NW':
                        raise ValueError('NRW requires reviewed entries')
                    continue  # Legacy data is explicitly shown as unconfirmed in the UI.
                for key in ('program_id', 'eligibility', 'last_checked'):
                    if not isinstance(entry.get(key), str) or not entry[key].strip():
                        raise ValueError(f'Missing {key}')
                if date.fromisoformat(entry['last_checked']) > datetime.now(UTC).date():
                    raise ValueError('Future review date')
                if entry['type'] not in {'Bund', 'Land', 'Kommune'} or entry.get('funding_type') not in KINDS:
                    raise ValueError('Invalid funding type')
                if not official_url(entry['link_portal']):
                    raise ValueError('Direct official program URL required')
                sources = entry.get('sources')
                if not isinstance(sources, list) or not sources or not all(official_url(url) for url in sources):
                    raise ValueError('Official evidence required')
                expected = {
                    'kfw-270': ('KfW 270 –', 'Förderkredit'),
                    'kfw-458': ('KfW 458 –', 'Direkter Zuschuss'),
                    'kfw-358-359': ('KfW 358/359 –', 'Förderkredit'),
                    'kfw-261': ('KfW 261 –', 'Förderkredit mit Tilgungszuschuss'),
                }.get(entry['program_id'])
                if expected and (not entry['title'].startswith(expected[0]) or entry['funding_type'] != expected[1]):
                    raise ValueError('Program number/title/funding mismatch')
                pid = entry['program_id']
                if pid in seen or (pid in identities and identities[pid] != entry):
                    raise ValueError('Duplicate or conflicting program')
                seen.add(pid)
                identities[pid] = entry
    return data


if __name__ == '__main__':
    validate(json.loads((ROOT / 'data/subsidies.json').read_text(encoding='utf-8')))
    print('Subsidy structure and reviewed-source metadata valid; content review remains mandatory.')
