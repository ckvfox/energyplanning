"""EnergyPlanning package validation and pinned shared FTPS transport adapter."""
from __future__ import annotations

import argparse
import ftplib
import hashlib
import importlib.util
import json
import sys
import traceback
from pathlib import Path

from build_deployment import ROOT, payload_files

PACKAGE = ROOT / "builds/full-deployment"
REMOTE_ROOT = "/energyplanning.great-site.net/htdocs"
STATE_NAME = ".energyplanning-auto-deploy.json"
RECEIPT = ROOT / "builds/auto-deploy-receipt.json"


def report_failure(exc: Exception) -> None:
    """Report code locations and fixed validation messages, never remote replies or locals."""
    print(f"EnergyPlanning deployment failed ({type(exc).__name__}); no successful deployment receipt written.")
    safe_reasons = {
        "Uploaded size differs from production package": "Uploaded file size does not match the package.",
        "Remote deployment state exceeds size limit": "Remote deployment checkpoint exceeds the size limit.",
        "Package differs from the complete productive allowlist": "Local package differs from the productive allowlist.",
    }
    if type(exc) is ValueError and str(exc) in safe_reasons:
        print(safe_reasons[str(exc)])
    for frame in traceback.extract_tb(exc.__traceback__):
        name = Path(frame.filename).name
        if name in {"deploy_site.py", "deploy_ftps.py", "ftplib.py", "ssl.py"}:
            print(f"Failure location: {name}:{frame.lineno}")


def manifest(package: Path) -> dict:
    if package.is_symlink() or package.resolve() != ROOT / "builds/full-deployment":
        raise ValueError("Upload must use the canonical EnergyPlanning full package")
    allowed = {p.as_posix() for p in payload_files()}
    paths = {}
    for path in package.rglob("*"):
        if path.is_symlink():
            raise ValueError("Symlinks cannot be deployed")
        if path.is_file():
            paths[path.relative_to(package).as_posix()] = path
    if paths.keys() != allowed:
        raise ValueError("Package differs from the complete productive allowlist")
    return {name: {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "size": path.stat().st_size}
            for name, path in sorted(paths.items())}


def load_transport(directory: Path):
    source = directory / "deploy_ftps.py"
    if not source.is_file():
        raise ValueError("Pinned FTPS helper checkout is missing")
    # The workflow checks out only these two files at a reviewed, immutable SHA.
    sys.path.insert(0, str(directory))
    spec = importlib.util.spec_from_file_location("shared_static_ftps", source)
    transport = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(transport)
    return transport


def publish(transport, *, commit: str, force: bool = False) -> dict:
    return transport.publish_package(PACKAGE, manifest(PACKAGE), commit=commit,
                                     remote_root=REMOTE_ROOT, state_name=STATE_NAME, force=force)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        result = publish(load_transport(ROOT / ".deployment-tools/scripts"), commit=args.commit, force=args.force)
        RECEIPT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"FTPS complete: {len(result['uploaded_files'])} uploaded, {result['skipped_files']} unchanged, 0 deleted")
        return 0
    except (OSError, ValueError, ImportError, RuntimeError, ftplib.Error, EOFError) as exc:
        report_failure(exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
