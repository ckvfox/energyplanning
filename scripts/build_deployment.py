from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import csscompressor
import rjsmin

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = ["index.html", "datenschutz.html", "impressum.html", "robots.txt", "sitemap.xml", ".htaccess", "service-worker.js"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a minified static EnergyPlanning payload outside the repository.")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    output = args.output_dir.resolve()
    if output == ROOT or ROOT in output.parents:
        raise SystemExit("Deployment output must be outside the repository.")
    if output.exists():
        raise SystemExit("Output directory already exists; choose an empty new directory.")
    output.mkdir(parents=True)

    for name in ROOT_FILES:
        source = ROOT / name
        if source.is_file():
            shutil.copy2(source, output / name)
    shutil.copytree(ROOT / "images", output / "images")
    shutil.copytree(ROOT / "data", output / "data", ignore=shutil.ignore_patterns("tmp", "*.pdf"))
    (output / "scripts").mkdir()
    for source in (ROOT / "scripts").glob("*.js"):
        code = source.read_text(encoding="utf-8")
        (output / "scripts" / source.name).write_text(rjsmin.jsmin(code), encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    (output / "style.css").write_text(csscompressor.compress(css), encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
