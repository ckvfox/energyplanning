"""Offline acceptance for automatic EnergyPlanning packaging and deployment."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import build_deployment as builder
import deploy_site


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        for name, value in {"index.html": '<link href="style.css?v=old"><script src="scripts/script.js?v=old"></script>',
                            "style.css": "body { color: red; }", "scripts/script.js": "const x = 1;",
                            "service-worker.js": "const CACHE_NAME = 'energyplanning-v3'; const shell = ['style.css?v=old'];",
                            "data/data.json": '{"x":1}'}.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value, encoding="utf-8")
        self.files = [Path(p) for p in ("index.html", "style.css", "scripts/script.js", "service-worker.js", "data/data.json")]

    def test_minification_fingerprints_are_stable_and_change_with_assets(self):
        with patch.object(builder, "ROOT", self.source):
            builder.build(self.root / "first", self.files)
            builder.build(self.root / "same", self.files)
            for path in self.files:
                self.assertEqual((self.root / "first" / path).read_bytes(), (self.root / "same" / path).read_bytes())
            first = (self.root / "first/index.html").read_text()
            self.assertNotIn("?v=old", first)
            (self.source / "style.css").write_text("body { color: blue; }", encoding="utf-8")
            builder.build(self.root / "changed", self.files)
            self.assertNotEqual(first, (self.root / "changed/index.html").read_text())
            self.assertNotEqual((self.root / "first/service-worker.js").read_text(),
                                (self.root / "changed/service-worker.js").read_text())

    def test_full_only_clears_both_canonical_folders_without_empty_delta_error(self):
        with patch.object(builder, "ROOT", self.source):
            for folder in ("full-deployment", "delta-deployment"):
                path = self.source / "builds" / folder
                path.mkdir(parents=True)
                (path / "old.txt").write_text("old")
            builder.refresh_packages(self.files, [])
            self.assertEqual(len(list((self.source / "builds/delta-deployment").iterdir())), 0)
            self.assertTrue((self.source / "builds/full-deployment/index.html").is_file())
            self.assertFalse((self.source / "builds/full-deployment/old.txt").exists())

    def test_upload_uses_only_validated_package_and_energyplanning_destination(self):
        with patch.object(builder, "ROOT", self.source):
            builder.refresh_packages(self.files, [])
        package = self.source / "builds/full-deployment"
        transport = Mock()
        transport.publish_package.return_value = {"deleted_files": 0}
        with patch.object(deploy_site, "ROOT", self.source), patch.object(deploy_site, "PACKAGE", package), \
             patch.object(deploy_site, "payload_files", return_value=self.files):
            self.assertEqual(deploy_site.publish(transport, commit="a" * 40), {"deleted_files": 0})
            call = transport.publish_package.call_args
            self.assertEqual(call.kwargs["remote_root"], "/energyplanning.great-site.net/htdocs")
            self.assertEqual(call.kwargs["state_name"], ".energyplanning-auto-deploy.json")
            (package / "unexpected.json").write_text("{}")
            with self.assertRaises(ValueError):
                deploy_site.manifest(package)
            (package / "unexpected.json").unlink()
            (package / "index.html").unlink()
            with self.assertRaises(ValueError):
                deploy_site.manifest(package)

    def test_workflow_gates_and_monthly_completion_trigger(self):
        root = Path(__file__).resolve().parents[1]
        text = (root / ".github/workflows/auto-deploy.yml").read_text(encoding="utf-8")
        self.assertIn("branches: [main]", text)
        self.assertIn('workflows: ["Update subsidies.json"]', text)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", text)
        self.assertIn("github.event.workflow_run.head_repository.full_name == github.repository", text)
        self.assertIn("ref: edd3e6a839d172de4163473492dd0e5593244a82", text)
        self.assertLess(text.index("python -m ruff check"), text.index("python scripts/deploy_site.py"))
        self.assertLess(text.index("fpf_project_compliance.py"), text.index("python scripts/deploy_site.py"))
        self.assertIn("group: energyplanning-production", text)
        monthly = (root / ".github/workflows/fetch_subsidies.yml").read_text(encoding="utf-8")
        self.assertIn("group: energyplanning-production", monthly)
        self.assertNotIn("OPENAI_API_KEY", text)

    def test_productive_registry_excludes_automation_and_tests(self):
        files = {p.as_posix() for p in builder.payload_files()}
        self.assertNotIn("scripts/deploy_site.py", files)
        self.assertNotIn("scripts/test_deployment.py", files)
        self.assertIn("service-worker.js", files)
        self.assertIn("data/subsidies.json", files)
        self.assertIn(".well-known/security.txt", files)
        for name in ("data/data.json", "data/subsidies.json"):
            json.loads((builder.ROOT / name).read_text(encoding="utf-8"))
