from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from corpus_bridge import CorpusBridgeService, CorpusIndex, make_handler


class CorpusBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "exports"
        self.root.mkdir()
        (self.root / "Userscript Master Architecture.md").write_text(
            """# Userscript Master Architecture\n\nAuto Driller should recover prior chat context before it asks follow-up questions.\nHyperCore keeps persistent browser memory so the system does not relearn the same state.\n""",
            encoding="utf-8",
        )
        (self.root / "Case chronology.md").write_text(
            """# Case chronology\n\nYamatani appears in the docket chronology. The argument developed after the docket discovery.\n""",
            encoding="utf-8",
        )
        self.db = Path(self.tmp.name) / "corpus.sqlite3"
        self.index = CorpusIndex(self.db, [self.root], refresh_seconds=0)
        self.index.refresh(force=True)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_retrieves_relevant_export(self) -> None:
        result = self.index.search(
            "Auto Driller userscript",
            keywords=["Auto Driller", "userscript"],
            latest_user_text="Auto Driller userscript",
            platform="chatgpt",
            page_url="https://chatgpt.com/c/one",
        )
        self.assertTrue(result["matches"])
        self.assertEqual(result["matches"][0]["title"], "Userscript Master Architecture")
        self.assertIn("Auto Driller", result["matches"][0]["text"])

    def test_weak_prompt_reuses_previous_strong_query(self) -> None:
        session = "https://chatgpt.com/c/continuity"
        first = self.index.search(
            "Yamatani docket chronology",
            latest_user_text="What about Yamatani docket chronology?",
            platform="chatgpt",
            page_url=session,
        )
        self.assertFalse(first["weak_query"])
        second = self.index.search(
            "test",
            latest_user_text="Plz test it",
            platform="chatgpt",
            page_url=session,
        )
        self.assertTrue(second["weak_query"])
        self.assertTrue(second["continuity_from_previous"])
        self.assertEqual(second["effective_query"], "Yamatani docket chronology")
        self.assertEqual(second["matches"][0]["title"], "Case chronology")

    def test_incremental_refresh_picks_up_changes(self) -> None:
        path = self.root / "Userscript Master Architecture.md"
        path.write_text(path.read_text(encoding="utf-8") + "\nSleeper agent continuity wakes and recovers state.\n", encoding="utf-8")
        self.index.refresh(force=False)
        result = self.index.search("sleeper agent continuity", latest_user_text="sleeper agent continuity")
        self.assertTrue(result["matches"])
        self.assertEqual(result["matches"][0]["title"], "Userscript Master Architecture")

    def test_http_contract_matches_userscript(self) -> None:
        service = CorpusBridgeService(self.index)
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_address[1]
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/search",
                data=json.dumps(
                    {
                        "query": "Auto Driller",
                        "keywords": ["Auto Driller"],
                        "latestUserText": "Auto Driller",
                        "platform": "chatgpt",
                        "pageUrl": "https://chatgpt.com/c/http-test",
                        "limit": 4,
                    }
                ).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(response.status, 200)
            self.assertTrue(payload["matches"])
            self.assertEqual(payload["matches"][0]["title"], "Userscript Master Architecture")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_indexing_never_mutates_source_files(self) -> None:
        path = self.root / "Userscript Master Architecture.md"
        before = path.read_bytes()
        self.index.refresh(force=True)
        self.index.search("Auto Driller", latest_user_text="Auto Driller")
        after = path.read_bytes()
        self.assertEqual(before, after)

    def test_health_reports_derived_index_state(self) -> None:
        stats = self.index.stats()
        self.assertTrue(stats["ready"])
        self.assertEqual(stats["documents"], 2)
        self.assertGreaterEqual(stats["chunks"], 2)


if __name__ == "__main__":
    unittest.main()
