"""Offline regression tests using the installed SDK and a mocked HTTP transport."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import fetch_subsidies
import fetch_subsidy_prices
import httpx
from openai import OpenAI


class UpdaterCompatibilityTests(unittest.TestCase):
    def test_fetchers_use_installed_responses_api(self):
        entries = [{"title": "Test", "type": "Bund", "description": "Testprogramm"}]
        replies = iter([json.dumps(entries), '{"electricity": 0.35}'])

        def respond(request):
            self.assertEqual(request.url.path, "/v1/responses")
            self.assertEqual(json.loads(request.content)["model"], "gpt-4.1-mini")
            return httpx.Response(200, json={
                "id": "resp_test", "object": "response", "created_at": 0,
                "status": "completed", "model": "gpt-4.1-mini",
                "output": [{"id": "msg_test", "type": "message",
                            "role": "assistant", "status": "completed",
                            "content": [{"type": "output_text", "text": next(replies),
                                         "annotations": []}]}],
            })

        with OpenAI(api_key="offline-test", base_url="https://example.invalid/v1",
                    http_client=httpx.Client(transport=httpx.MockTransport(respond))) as client:
            fetch_subsidy_prices.validate_responses_client(client)
            self.assertEqual(fetch_subsidies.fetch_for(client, "BW", "pv")[0]["title"], "Test")
            self.assertEqual(fetch_subsidy_prices.fetch_market_prices(client), {"electricity": 0.35})

    @patch("fetch_subsidy_prices.load_dotenv")
    def test_existing_legacy_client_is_rejected(self, _load_dotenv):
        with self.assertRaisesRegex(SystemExit, "Responses API"):
            fetch_subsidy_prices.ensure_client(SimpleNamespace())

    @patch("fetch_subsidy_prices.load_dotenv")
    @patch("fetch_subsidy_prices.os.environ.get", return_value="offline-test")
    @patch("fetch_subsidy_prices.OpenAI", return_value=SimpleNamespace())
    def test_legacy_client_stops_before_reading_or_writing_data(self, *_mocks):
        with patch.object(fetch_subsidies, "load_existing") as load_existing:
            with self.assertRaisesRegex(SystemExit, "Responses API"):
                fetch_subsidies.main()
            load_existing.assert_not_called()


if __name__ == "__main__":
    unittest.main()
