"""Update sitemap lastmod values from the corresponding local files."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / "sitemap.xml"
URL_TO_FILE = {
    "https://energyplanning.great-site.net/": ROOT / "index.html",
    "https://energyplanning.great-site.net/impressum.html": ROOT / "impressum.html",
    "https://energyplanning.great-site.net/datenschutz.html": ROOT / "datenschutz.html",
}
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def main() -> None:
    ET.register_namespace("", NS["sm"])
    tree = ET.parse(SITEMAP)
    for url in tree.findall("sm:url", NS):
        loc = url.find("sm:loc", NS)
        if loc is None or loc.text not in URL_TO_FILE:
            continue
        source = URL_TO_FILE[loc.text]
        modified = datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).date().isoformat()
        lastmod = url.find("sm:lastmod", NS)
        if lastmod is None:
            lastmod = ET.SubElement(url, f"{{{NS['sm']}}}lastmod")
        lastmod.text = modified
    tree.write(SITEMAP, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
