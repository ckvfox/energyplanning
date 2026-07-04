"""
Fetch market price assumptions and update data.json when deviations exceed tolerance.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

from dotenv import load_dotenv
import openai
from openai import OpenAI

from prompts import PRICE_SYSTEM_PROMPT

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "data.json"

FIELD_MAP: Dict[str, Tuple[str, ...]] = {
    "electricity": ("prices", "electricity_eur_per_kwh"),
    "gas": ("prices", "gas_eur_per_kwh"),
    "feed_in": ("prices", "feed_in_eur_per_kwh"),
    "pv_cost_per_kwp": ("pv", "cost_per_kwp"),
    "battery_cost_per_kwh": ("battery", "cost_per_kwh"),
    "heatpump_cost_per_kw": ("heatpump", "cost_per_kw"),
    "wallbox_cost": ("costs", "wallbox_cost"),
    "aircon_cost": ("costs", "aircon_cost"),
    "aircon_annual_kwh_per_indoor_unit": ("aircon", "annual_kwh_per_indoor_unit"),
    "aircon_single_split_purchase_cost": ("aircon", "single_split_purchase_cost"),
    "aircon_single_split_installation_cost": ("aircon", "single_split_installation_cost"),
    "aircon_multisplit_purchase_cost_2_units": ("aircon", "multisplit_purchase_costs", "2"),
    "aircon_multisplit_purchase_cost_3_units": ("aircon", "multisplit_purchase_costs", "3"),
    "aircon_multisplit_purchase_cost_4_units": ("aircon", "multisplit_purchase_costs", "4"),
    "aircon_multisplit_extra_purchase_cost_per_indoor_unit": (
        "aircon",
        "multisplit_extra_purchase_cost_per_indoor_unit",
    ),
    "aircon_installation_base_cost": ("aircon", "installation_base_cost"),
    "aircon_installation_extra_cost_per_indoor_unit": ("aircon", "installation_extra_cost_per_indoor_unit"),
    "aircon_connection_and_leak_test_cost": ("aircon", "connection_and_leak_test_cost"),
    "aircon_maintenance_cost_min": ("aircon", "maintenance_cost_min"),
    "aircon_maintenance_cost_max": ("aircon", "maintenance_cost_max"),
}

AIRCON_NESTED_FIELD_MAP: Dict[str, str] = {
    "annual_kwh_per_indoor_unit": "aircon_annual_kwh_per_indoor_unit",
    "single_split_purchase_cost": "aircon_single_split_purchase_cost",
    "single_split_installation_cost": "aircon_single_split_installation_cost",
    "multisplit_extra_purchase_cost_per_indoor_unit": "aircon_multisplit_extra_purchase_cost_per_indoor_unit",
    "installation_base_cost": "aircon_installation_base_cost",
    "installation_extra_cost_per_indoor_unit": "aircon_installation_extra_cost_per_indoor_unit",
    "connection_and_leak_test_cost": "aircon_connection_and_leak_test_cost",
    "maintenance_cost_min": "aircon_maintenance_cost_min",
    "maintenance_cost_max": "aircon_maintenance_cost_max",
}

ALIASES: Dict[str, str] = {
    "electricity_eur_per_kwh": "electricity",
    "gas_eur_per_kwh": "gas",
    "feed_in_eur_per_kwh": "feed_in",
    "aircon_single_split_total_cost": "aircon_cost",
    "aircon_cost_single_split": "aircon_cost",
    "aircon_purchase_cost_single_split": "aircon_single_split_purchase_cost",
    "aircon_installation_cost_single_split": "aircon_single_split_installation_cost",
    "aircon_multisplit_2_units": "aircon_multisplit_purchase_cost_2_units",
    "aircon_multisplit_3_units": "aircon_multisplit_purchase_cost_3_units",
    "aircon_multisplit_4_units": "aircon_multisplit_purchase_cost_4_units",
}


def ensure_client(existing: OpenAI | None = None) -> OpenAI:
    load_dotenv()

    version = getattr(openai, "__version__", "0.0.0")
    try:
        major = int(version.split(".")[0])
    except Exception:  # noqa: BLE001
        major = 0
    if major < 1:
        raise SystemExit(
            f"Inkompatible openai-Version ({version}). Bitte `pip install --upgrade openai httpx` ausfuehren."
        )

    if existing:
        return existing

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY not set")

    try:
        return OpenAI(api_key=api_key)
    except TypeError as exc:
        raise SystemExit(
            "Fehler beim Initialisieren des OpenAI-Clients (moeglicherweise alte httpx/openai-Version). "
            "Bitte `pip install --upgrade openai httpx` und erneut versuchen."
        ) from exc


def parse_prices_response(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:  # noqa: BLE001
        if "{" in text and "}" in text:
            try:
                frag = text[text.index("{") : text.rindex("}") + 1]
                return json.loads(frag)
            except Exception:
                pass
        print(f"[WARN] Konnte Antwort nicht parsen: {text[:200]!r}")
        return {}


def fetch_market_prices(client: OpenAI) -> Dict[str, Any]:
    user_prompt = "Bitte liefere die Werte als kompaktes JSON mit klaren numerischen Feldern."
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "system", "content": PRICE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    text = response.output_text  # type: ignore[attr-defined]
    return parse_prices_response(text)


def get_nested(data: Dict[str, Any], path: Iterable[str]) -> Any:
    cur: Any = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def set_nested(data: Dict[str, Any], path: Iterable[str], value: Any) -> None:
    cur: Dict[str, Any] = data
    *parents, last = path
    for key in parents:
        if key not in cur or not isinstance(cur[key], dict):
            cur[key] = {}
        cur = cur[key]  # type: ignore[assignment]
    cur[last] = value


def needs_update(current: Any, new: Any) -> bool:
    if not isinstance(new, (int, float)):
        return False
    if current in (None, 0) or not isinstance(current, (int, float)):
        return True
    if current == 0:
        return True
    return abs(new - current) / abs(current) > 0.2


def coerce_number(value: Any) -> float | int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        cleaned = value.strip().replace("€", "").replace("EUR", "").replace("kWh", "")
        cleaned = cleaned.replace(" ", "").replace(".", "").replace(",", ".")
        try:
            parsed = float(cleaned)
        except ValueError:
            return None
        return int(parsed) if parsed.is_integer() else parsed
    return None


def flatten_aircon_values(raw: Dict[str, Any], normalized: Dict[str, Any]) -> None:
    aircon = raw.get("aircon")
    if not isinstance(aircon, dict):
        return

    for nested_key, flat_key in AIRCON_NESTED_FIELD_MAP.items():
        if flat_key not in normalized and nested_key in aircon:
            normalized[flat_key] = aircon[nested_key]

    purchase_costs = aircon.get("multisplit_purchase_costs")
    if isinstance(purchase_costs, dict):
        for units in ("2", "3", "4"):
            flat_key = f"aircon_multisplit_purchase_cost_{units}_units"
            if flat_key not in normalized and units in purchase_costs:
                normalized[flat_key] = purchase_costs[units]


def normalize_source_values(raw: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(raw)

    for alias, canonical in ALIASES.items():
        if canonical not in normalized and alias in raw:
            normalized[canonical] = raw[alias]

    flatten_aircon_values(raw, normalized)

    for key in list(normalized):
        if key in FIELD_MAP:
            coerced = coerce_number(normalized[key])
            if coerced is None:
                normalized.pop(key, None)
            else:
                normalized[key] = coerced

    return normalized


def update_price_data(client: OpenAI | None = None) -> bool:
    client = ensure_client(client)
    market_values = fetch_market_prices(client)
    if not market_values:
        print("[WARN] Keine neuen Marktwerte erhalten.")
        return False

    normalized_values = normalize_source_values(market_values)

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    changed = False

    for key, path in FIELD_MAP.items():
        if key not in normalized_values:
            continue
        new_value = normalized_values[key]
        current_value = get_nested(data, path)
        if needs_update(current_value, new_value):
            set_nested(data, path, new_value)
            changed = True
            print(f"[INFO] Aktualisiere {'.'.join(path)}: {current_value} -> {new_value}")

    if changed:
        DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    else:
        print("[INFO] Keine Aenderungen erforderlich (alle Werte innerhalb +-20%).")

    return changed


if __name__ == "__main__":
    update_price_data()
