"""
Fetch subsidies per Bundesland and measure type using OpenAI API.
Requires OPENAI_API_KEY to be set. Updates data/subsidies.json in-place.
"""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
import openai
from openai import OpenAI

from prompts import SUBSIDY_SYSTEM_PROMPT
from fetch_subsidy_prices import update_price_data

ROOT = Path(__file__).resolve().parent.parent
SUBSIDY_PATH = ROOT / "data" / "subsidies.json"

BUNDESLAENDER = [
    "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
    "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
]

MEASURES = [
    "pv",
    "battery",
    "heatpump",
    "heating_optimization",
    "building_envelope",
]

def load_existing() -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    if SUBSIDY_PATH.exists():
        return json.loads(SUBSIDY_PATH.read_text(encoding="utf-8"))
    return {state: {m: [] for m in MEASURES} for state in BUNDESLAENDER}


def validate_entries(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    valid = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        if not all(k in item for k in ("title", "type", "description")):
            continue
        valid.append(
            {
                "title": item.get("title", ""),
                "type": item.get("type", ""),
                "description": item.get("description", ""),
                "source_level": item.get("source_level", ""),
            }
        )
    return valid


def parse_response(text: str, bundesland: str, measure: str) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(text)
        return validate_entries(parsed)
    except Exception as exc:  # noqa: BLE001
        # Fallback: versuche den erstbesten JSON-Array-Block herauszuschneiden
        if "[" in text and "]" in text:
            try:
                frag = text[text.index("[") : text.rindex("]") + 1]
                parsed = json.loads(frag)
                return validate_entries(parsed)
            except Exception:
                pass
        print(f"[WARN] Parsing-Fehler bei {bundesland}/{measure}: {exc}. Antwort (gekuerzt): {text[:200]!r}")
        return []


def fetch_for(client: OpenAI, bundesland: str, measure: str) -> List[Dict[str, Any]]:
    today = date.today().isoformat()
    user_prompt = (
        f"Gib mir aktuelle Foerderprogramme in Deutschland fuer das Bundesland {bundesland} "
        f"und die Massnahme {measure} (z.B. Photovoltaik, Waermepumpe, Batteriespeicher, "
        f"Heizungsoptimierung, Daemmung/Fenster) im Bereich Wohngebaeude.\n"
        "Antworte als JSON-Array von Objekten mit Feldern: title, type (Bund/Land/Kommune), "
        "description (max. 2 Saetze), source_level (bund/land/kommune). "
        "Erstelle KEINE Links oder Deep-Links. "
        "Wenn du keine sicheren Programme kennst, antworte mit []."
    )
    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {"role": "system", "content": SUBSIDY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        # Der Responses-API liefert Text im ersten output-Element
        text = response.output_text  # type: ignore[attr-defined]
        return parse_response(text, bundesland, measure)
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] Fehler bei {bundesland}/{measure}: {exc}")
        return []


def main() -> None:
    # Load .env if present so OPENAI_API_KEY is available
    load_dotenv()

    # Basic version check to avoid legacy 0.x installs
    version = getattr(openai, "__version__", "0.0.0")
    try:
        major = int(version.split(".")[0])
    except Exception:  # noqa: BLE001
        major = 0
    if major < 1:
        raise SystemExit(
            f"Inkompatible openai-Version ({version}). Bitte `pip install --upgrade openai httpx` ausfuehren."
        )

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY not set")

    try:
        client = OpenAI(api_key=api_key)
    except TypeError as exc:
        raise SystemExit(
            "Fehler beim Initialisieren des OpenAI-Clients (moeglicherweise alte httpx/openai-Version). "
            "Bitte `pip install --upgrade openai httpx` und erneut versuchen."
        ) from exc
    data = load_existing()

    for state in BUNDESLAENDER:
        print(f"[INFO] Aktualisiere {state} ...")
        if state not in data:
            data[state] = {m: [] for m in MEASURES}
        for measure in MEASURES:
            entries = fetch_for(client, state, measure)
            cleaned_entries: List[Dict[str, Any]] = []
            for entry in entries:
                entry_type = (entry.get("type") or "").strip()
                type_lower = entry_type.lower()
                if type_lower == "bund":
                    link_portal = "https://www.energiewechsel.de"
                elif type_lower == "land":
                    link_portal = "https://www.foerderdatenbank.de"
                else:
                    link_portal = "https://www.co2online.de/foerdermittel/foerdermittel-check/"

                cleaned_entries.append(
                    {
                        "title": entry.get("title", ""),
                        "type": entry_type,
                        "description": entry.get("description", ""),
                        "link_portal": link_portal,
                    }
                )

            data[state][measure] = cleaned_entries
            status = f"{len(entries)} Eintraege" if entries else "keine Eintraege"
            print(f"  - {measure}: {status}")

    SUBSIDY_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[DONE] subsidies.json aktualisiert: {SUBSIDY_PATH}")

    price_changed = update_price_data(client)
    if price_changed:
        print("[DONE] data.json (Preisannahmen) aktualisiert.")


if __name__ == "__main__":
    main()
