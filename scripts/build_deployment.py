from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

import csscompressor
import rjsmin

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = [
    "index.html", "datenschutz.html", "impressum.html", "robots.txt",
    "sitemap.xml", ".htaccess", "service-worker.js", "favicon.ico",
    "google60f6cdba136e03e9.html", ".well-known/security.txt",
]
BROWSER_SCRIPTS = [
    "script.js", "performance.js", "calculation-core.js",
    "chart-ui.js", "pdf-export.js", "subsidy-ui.js",
]


def payload_files() -> list[Path]:
    files = [Path(name) for name in ROOT_FILES + ["style.css"]]
    files += [Path("scripts") / name for name in BROWSER_SCRIPTS]
    files += [Path("data/data.json"), Path("data/subsidies.json")]
    files += [
        p.relative_to(ROOT) for p in (ROOT / "images").rglob("*")
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"}
    ]
    for relative in files:
        source = ROOT / relative
        if not source.is_file() or source.is_symlink():
            raise ValueError(f"Missing or unsafe payload file: {relative}")
    return sorted(files)


def build(output: Path, files: list[Path]) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for relative in files:
        source, target = ROOT / relative, output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # rjsmin 1.2.4 changes literal whitespace in script.js nested templates.
        # Preserve this orchestration source verbatim until a parser-based minifier is adopted.
        if source.suffix == ".js" and relative != Path("scripts/script.js"):
            target.write_text(rjsmin.jsmin(source.read_text(encoding="utf-8")), encoding="utf-8")
        elif source.suffix == ".css":
            target.write_text(csscompressor.compress(source.read_text(encoding="utf-8")), encoding="utf-8")
        else:
            shutil.copy2(source, target)
    # Content-derived URLs change only when their asset bytes change.
    versions = {
        p.as_posix(): hashlib.sha256((output / p).read_bytes()).hexdigest()[:12]
        for p in files if p.suffix.lower() in {".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"}
        and p.name != "service-worker.js"
    }
    for relative in files:
        if relative.suffix != ".html" and relative.name != "service-worker.js":
            continue
        target = output / relative
        text = target.read_text(encoding="utf-8")
        for asset, version in versions.items():
            pattern = r"([\"'])(\./)?" + re.escape(asset) + r"(?:\?v=[^\"'\s)]+)?([\"'])"
            text = re.sub(pattern, lambda match: f"{match[1]}{match[2] or ''}{asset}?v={version}{match[3]}", text)
        target.write_text(text, encoding="utf-8")
    # Rotating the worker cache also refreshes offline fallbacks after data updates.
    worker = output / "service-worker.js"
    if worker.is_file():
        digest = hashlib.sha256()
        for relative in files:
            digest.update(relative.as_posix().encode())
            digest.update((output / relative).read_bytes())
        text = re.sub(r"(const CACHE_NAME\s*=\s*)['\"][^'\"]+['\"]",
                      rf"\g<1>'energyplanning-{digest.hexdigest()[:16]}'", worker.read_text(encoding="utf-8"))
        worker.write_text(text, encoding="utf-8")


def git(*args: str) -> str:
    return subprocess.check_output(["git", "--work-tree=" + str(ROOT), *args], cwd=ROOT, text=True).strip()


def retry_readonly(function, path, exc_info):
    error = exc_info[1]
    if not isinstance(error, PermissionError):
        raise error
    os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    function(path)


def refresh_packages(files: list[Path], delta: list[Path]) -> None:
    builds = ROOT / "builds"
    if builds.is_symlink() or (builds.exists() and builds.resolve() != ROOT / "builds"):
        raise SystemExit("Unsafe builds directory.")
    targets = [builds / "full-deployment", builds / "delta-deployment"]
    for target in targets:
        if target.is_symlink() or target.resolve() != ROOT / "builds" / target.name:
            raise SystemExit("Unsafe package target.")
    # Finish compilation first; failures leave the previous handover intact.
    with tempfile.TemporaryDirectory(prefix="energyplanning-build-") as temporary:
        staged = Path(temporary)
        full, patch = staged / "full", staged / "delta"
        build(full, files)
        patch.mkdir()
        for relative in delta:
            target = patch / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(full / relative, target)
        for target in targets:
            if target.exists():
                for child in target.iterdir():
                    if child.is_dir() and not child.is_symlink():
                        shutil.rmtree(child, onerror=retry_readonly)
                    else:
                        child.unlink()
        shutil.copytree(full, targets[0], dirs_exist_ok=True)
        shutil.copytree(patch, targets[1], dirs_exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a minified payload or refresh local Full/Delta FTP packages.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--output-dir", type=Path, help="New external full-payload directory.")
    mode.add_argument("--full-only", action="store_true", help="Refresh canonical full package for automation; clear delta.")
    mode.add_argument("--base-ref", help="Explicit Git baseline before the changes to deliver in the local delta.")
    args = parser.parse_args()
    files = payload_files()
    if args.output_dir:
        output = args.output_dir.resolve()
        if output == ROOT or ROOT in output.parents:
            raise SystemExit("External output must be outside the repository.")
        if output.exists():
            raise SystemExit("Output directory already exists.")
        build(output, files)
        print(output)
        return 0

    if args.full_only:
        refresh_packages(files, [])
        print(f"Full: {len(files)} productive files; Delta: 0 (explicit full-only mode)")
        return 0

    base = git("rev-parse", "--verify", args.base_ref + "^{commit}")
    changed = set(git("diff", "--name-only", "--no-renames", base, "--").splitlines())
    changed.update(git("ls-files", "--others", "--exclude-standard").splitlines())
    delta = [p for p in files if p.as_posix() in changed]
    if not delta:
        raise SystemExit("No productive changes against the supplied baseline; existing packages preserved.")
    # Ship image dependencies whenever a changed stylesheet may refer to them.
    if Path("style.css") in delta:
        css = (ROOT / "style.css").read_text(encoding="utf-8")
        for url in re.findall(r"url\(\s*([^)]*?)\s*\)", css):
            url = url.strip("\"'").split("?", 1)[0].split("#", 1)[0]
            if not url or ":" in url or url.startswith("//"):
                continue
            asset = Path(url.lstrip("/"))
            if asset not in files:
                raise SystemExit(f"CSS dependency missing from productive allowlist: {asset}")
            delta.append(asset)
        delta = sorted(set(delta))
    deleted = git("diff", "--name-only", "--diff-filter=D", base, "--").splitlines()
    productive_deleted = [
        p for p in deleted
        if p in ROOT_FILES or p == "style.css"
        or p in {"scripts/" + name for name in BROWSER_SCRIPTS}
        or p in {"data/data.json", "data/subsidies.json"}
        or (p.startswith("images/") and Path(p).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"})
    ]
    if productive_deleted:
        raise SystemExit("Productive deletions require an explicit removal plan: " + ", ".join(productive_deleted))
    refresh_packages(files, delta)
    print(f"Baseline: {base}; HEAD: {git('rev-parse', 'HEAD')}")
    print(f"Full: {len(files)} files; Delta: {len(delta)} files")
    for relative in delta:
        print(relative.as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
