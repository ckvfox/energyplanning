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
                fetch_subsidies.propose_subsidies()
            load_existing.assert_not_called()


class PriceMutationPolicyTests(unittest.TestCase):
    def test_legacy_entry_point_never_reads_writes_or_calls_api(self):
        with patch.object(fetch_subsidy_prices, "ensure_client") as client, \
                patch.object(fetch_subsidy_prices.DATA_PATH.__class__, "write_text") as write:
            self.assertFalse(fetch_subsidy_prices.update_price_data())
            client.assert_not_called()
            write.assert_not_called()

    def test_proposals_are_marked_unverified_and_do_not_write(self):
        with patch.object(fetch_subsidy_prices, "ensure_client", return_value=object()), \
                patch.object(fetch_subsidy_prices, "fetch_market_prices", return_value={"electricity": .4}), \
                patch.object(fetch_subsidy_prices.DATA_PATH.__class__, "write_text") as write:
            proposal = fetch_subsidy_prices.propose_prices()
            self.assertEqual(proposal["status"], "unverified_model_proposal_do_not_apply")
            self.assertEqual(proposal["values"], {"electricity": .4})
            write.assert_not_called()




class PublicationSafetyTests(unittest.TestCase):
    def test_proposal_never_reads_or_writes_published_data(self):
        with patch.object(fetch_subsidies, 'ensure_client', return_value=object()), \
                patch.object(fetch_subsidies, 'fetch_for', return_value=[]), \
                patch.object(fetch_subsidies, 'load_existing') as read, \
                patch.object(fetch_subsidies.Path, 'write_text') as write:
            result = fetch_subsidies.propose_subsidies()
            self.assertEqual(result['status'], 'unverified_model_proposal_do_not_apply')
            self.assertEqual(len(result['candidates']), 16)
            read.assert_not_called()
            write.assert_not_called()

    def test_cli_refuses_productive_and_repository_destinations(self):
        for output in (fetch_subsidies.SUBSIDY_PATH, fetch_subsidies.ROOT / 'data/data.json'):
            with self.subTest(output=output), \
                    patch('sys.argv', ['fetch_subsidies.py', '--proposal-output', str(output)]), \
                    patch.object(fetch_subsidies, 'ensure_client') as client:
                with self.assertRaises(SystemExit):
                    fetch_subsidies.main()
                client.assert_not_called()

    def test_reviewed_catalog_and_rejections(self):
        import copy

        from validate_subsidies import validate
        data = json.loads(fetch_subsidies.SUBSIDY_PATH.read_text())
        validate(data)
        for field, value in [('title', 'KfW 271/272 – Standard'), ('link_portal', 'https://www.kfw.de'),
                             ('link_portal', 'https://www.kfw.de.evil.test/program/detail/a'),
                             ('funding_type', 'Kredit und Zuschuss'),
                             ('eligibility', ''), ('sources', []),
                             ('last_checked', '2099-01-01'),
                             ('verification_status', 'unverified')]:
            bad = copy.deepcopy(data)
            bad['NW']['pv'][0][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate(bad)
        self.assertEqual(data['NW']['pv'][0]['program_id'], 'kfw-270')
        self.assertEqual(data['NW']['heatpump'][0]['program_id'], 'kfw-458')
        self.assertTrue(data['NW']['battery'])


if __name__ == "__main__":
    unittest.main()
