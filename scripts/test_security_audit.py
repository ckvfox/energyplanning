"""Offline classification, transport and resource-policy regression coverage."""

import base64
import hashlib
import re
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

import security_audit as audit

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "index.html").read_text(encoding="utf-8")
CHALLENGE = '<script src="/aes.js"></script><script>slowAES.decrypt();</script>'


class Response:
    def __init__(self, status, body="", headers=None):
        self.code = status
        self.headers = headers or {}
        self.body = body.encode()

    def read(self, size):
        return self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class AuditTests(unittest.TestCase):
    def test_challenge_is_not_a_missing_header_finding_even_with_project_headers(self):
        result = audit.classify(200, {"X-EnergyPlanning-Policy": "apache-v1"}, CHALLENGE)
        self.assertEqual(result["kind"], "hoster_js_challenge")
        self.assertIsNone(result["project_header_evaluation"])

    def test_denial_ownership_requires_explicit_evidence(self):
        for status in (403, 429):
            result = audit.classify(status, {"X-EnergyPlanning-Policy": "apache-v1"}, "Forbidden")
            self.assertEqual(result["kind"], "access_denied_unknown_source")
        self.assertEqual(audit.classify(403, {"X-EnergyPlanning-Denial": "hidden-path"}, "")["kind"],
                         "project_htaccess_denial")

    def test_application_identity_and_header_evaluation(self):
        result = audit.classify(200, {}, PAGE)
        self.assertEqual(result["kind"], "application")
        self.assertEqual(result["project_header_evaluation"]["missing"], list(audit.POLICY_HEADERS))
        for body in ("Access denied", '<link rel="canonical" href="' + audit.ORIGIN + '/">'):
            self.assertIsNone(audit.classify(200, {}, body)["project_header_evaluation"])

    def test_challenge_is_terminal_and_no_raw_response_is_reported(self):
        with patch.object(audit, "build_opener") as opener:
            opener.return_value.open.return_value = Response(200, CHALLENGE, {"Set-Cookie": "omitted"})
            result = audit.probe(audit.ORIGIN + "/", "test")
            self.assertEqual(opener.return_value.open.call_count, 1)
        self.assertEqual(result["terminal"], "hoster_js_challenge")
        self.assertNotIn("omitted", str(result))
        self.assertNotIn("slowAES", str(result))

    def test_redirect_chain_and_loop(self):
        with patch.object(audit, "build_opener") as opener:
            opener.return_value.open.side_effect = [
                Response(301, headers={"Location": audit.ORIGIN + "/"}), Response(200, PAGE)]
            result = audit.probe(f"http://{audit.HOST}/index.html", "test")
            self.assertEqual(len(result["hops"]), 2)
            self.assertTrue(result["hops"][0]["redirect_to_canonical_root"])
            self.assertEqual(result["terminal"], "application")
            opener.return_value.open.side_effect = None
            opener.return_value.open.return_value = Response(301, headers={"Location": "/"})
            self.assertEqual(audit.probe(audit.ORIGIN + "/", "test")["terminal"], "redirect_loop")

    def test_unsafe_redirects_are_never_followed(self):
        for location in ("https://example.org/", "http://" + audit.HOST + "/",
                         "https://" + audit.HOST + ":invalid/"):
            with self.subTest(location=location), patch.object(audit, "build_opener") as opener:
                opener.return_value.open.return_value = Response(302, headers={"Location": location})
                result = audit.probe(audit.ORIGIN + "/", "test")
                self.assertEqual(opener.return_value.open.call_count, 1)
                self.assertIn(result["terminal"], ("https_downgrade", "external_or_unsafe_redirect"))

    def test_network_failure_is_inconclusive_and_redacted(self):
        with patch.object(audit, "build_opener") as opener:
            opener.return_value.open.side_effect = OSError("private network detail")
            result = audit.probe(audit.ORIGIN + "/", "test")
        self.assertEqual(result, {"hops": [], "terminal": "network_error"})

    def test_http_error_response_is_classified(self):
        from io import BytesIO
        with patch.object(audit, "build_opener") as opener:
            opener.return_value.open.side_effect = HTTPError(
                audit.ORIGIN, 403, "Forbidden", {}, BytesIO(b"Forbidden"))
            self.assertEqual(audit.probe(audit.ORIGIN + "/", "test")["terminal"],
                             "access_denied_unknown_source")

    def test_policy_differences_are_visible_even_when_both_headers_exist(self):
        first = audit.classify(200, {"content-security-policy": "default-src 'self'"}, PAGE)
        second = audit.classify(200, {"content-security-policy": "default-src https:"}, PAGE)
        self.assertNotEqual(first["project_header_evaluation"]["policy_fingerprint"],
                            second["project_header_evaluation"]["policy_fingerprint"])

    def test_inconclusive_results_exit_separately_from_findings(self):
        with patch("sys.argv", ["security_audit.py"]), patch("builtins.print"), patch.object(audit, "probe") as probe:
            probe.return_value = {"hops": [], "terminal": "hoster_js_challenge"}
            self.assertEqual(audit.main(), 2)
            probe.return_value = {"hops": [audit.classify(200, {}, PAGE)], "terminal": "application"}
            self.assertEqual(audit.main(), 1)

    def test_ua_difference_does_not_claim_causation_or_security_success(self):
        challenge = {"hops": [], "terminal": "hoster_js_challenge"}
        app = {"hops": [], "terminal": "application"}
        comparison = audit.compare_profiles({"root": {"audit": challenge, "browser": app}})["root"]
        self.assertTrue(comparison["user_agent_difference_observed"])
        self.assertFalse(comparison["application_comparable"])
        same = audit.compare_profiles({"root": {"audit": challenge, "browser": challenge}})["root"]
        self.assertFalse(same["user_agent_difference_observed"])
        self.assertFalse(same["application_comparable"])


class ResourcePolicyTests(unittest.TestCase):
    def test_actual_html_resources_are_compatible_with_policy(self):
        htaccess = (ROOT / ".htaccess").read_text(encoding="utf-8")
        csp = re.search(r'Content-Security-Policy "([^"]+)"', htaccess)[1]
        for name in ("index.html", "datenschutz.html", "impressum.html"):
            page = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotRegex(page, r"(?i)\son[a-z]+\s*=")
            self.assertNotRegex(page, r"(?i)<iframe\b|http-equiv=[\"']refresh")
            for attrs, body in re.findall(r"<script\b([^>]*)>(.*?)</script>", page, re.DOTALL):
                src = re.search(r'src="([^"]+)"', attrs)
                if src and src[1].startswith("https:"):
                    self.assertIn(src[1], csp)
                    self.assertIn('integrity="sha384-', attrs)
                elif body.strip():
                    digest = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
                    self.assertIn("'sha256-" + digest + "'", csp)
            for href in re.findall(r'<link[^>]+href="([^"]+)"', page):
                if href.endswith(".css") or ".css?" in href:
                    self.assertFalse(href.startswith("http"))
        result = audit.classify(200, {"content-security-policy": csp, "referrer-policy": "same-origin"}, PAGE)
        evaluation = result["project_header_evaluation"]
        self.assertTrue(evaluation["inline_handlers_blocked"])
        self.assertTrue(evaluation["frames_blocked"])
        self.assertFalse(evaluation["client_redirect_detected"])
        self.assertIn("style-src 'self' 'unsafe-inline'", csp)
        self.assertIn("worker-src 'self'", csp)
        self.assertIn("connect-src 'self' https://cdn.jsdelivr.net", csp)


if __name__ == "__main__":
    unittest.main()
