"""
Fetch subsidies per Bundesland and measure type using OpenAI API.
Requires OPENAI_API_KEY. Writes unverified proposals outside the repository only.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fetch_subsidy_prices import ensure_client
from openai import OpenAI
from prompts import SUBSIDY_SYSTEM_PROMPT

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

def load_existing() -> dict[str, dict[str, list[dict[str, Any]]]]:
    if SUBSIDY_PATH.exists():
        return json.loads(SUBSIDY_PATH.read_text(encoding="utf-8"))
    return {state: {m: [] for m in MEASURES} for state in BUNDESLAENDER}


def validate_entries(raw: Any) -> list[dict[str, Any]]:
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
                "link": item.get("link", ""),
                "eligibility": item.get("eligibility", ""),
            }
        )
    return valid


def parse_response(text: str, bundesland: str, measure: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(text)
        return validate_entries(parsed)
    except json.JSONDecodeError as exc:
        parse_error = exc
        # Fallback: versuche den erstbesten JSON-Array-Block herauszuschneiden
        if "[" in text and "]" in text:
            try:
                frag = text[text.index("[") : text.rindex("]") + 1]
                parsed = json.loads(frag)
                return validate_entries(parsed)
            except json.JSONDecodeError as fallback_exc:
                parse_error = fallback_exc
        print(f"[WARN] Parsing-Fehler bei {bundesland}/{measure}: {parse_error}. Antwort (gekuerzt): {text[:200]!r}")
        return []


def fetch_for(client: OpenAI, bundesland: str, measure: str) -> list[dict[str, Any]]:
    user_prompt = (
        f"Gib mir aktuelle Foerderprogramme in Deutschland fuer das Bundesland {bundesland} "
        f"und die Massnahme {measure} (z.B. Photovoltaik, Waermepumpe, Batteriespeicher, "
        f"Heizungsoptimierung, Daemmung/Fenster) im Bereich Wohngebaeude.\n"
        "Antworte als JSON-Array von Objekten mit Feldern: title, type (Bund/Land/Kommune), "
        "description (max. 2 Saetze), source_level (bund/land/kommune), link, eligibility. "
        "Nenne konkrete offizielle Programmseiten nur wenn bekannt. Die Ausgabe ist ungeprueft. "
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


def propose_subsidies() -> dict[str, Any]:
    """Model output is research input, never approved publication data."""
    client = ensure_client()
    candidates = {}
    for state in BUNDESLAENDER:
        candidates[state] = {measure: fetch_for(client, state, measure) for measure in MEASURES}
    return {"status": "unverified_model_proposal_do_not_apply", "candidates": candidates}


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Generate unverified research proposals only")
    parser.add_argument("--proposal-output", type=Path, required=True)
    args = parser.parse_args()
    output = args.proposal_output.resolve()
    # Refuse all repository paths, including symlinks to productive data.
    if output == ROOT or ROOT in output.parents:
        parser.error("Proposal output must be outside the repository")
    proposal = propose_subsidies()
    output.write_text(json.dumps(proposal, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Unverified proposal saved; published subsidies unchanged.")


if __name__ == "__main__":
    main()
