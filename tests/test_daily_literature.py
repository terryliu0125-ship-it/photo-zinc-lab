from __future__ import annotations

import copy
import http.client
import io
import json
import re
import shutil
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import render_library as renderer
import update_literature as monitor

NOW = datetime(2026, 10, 12, 0, 20, tzinfo=timezone.utc)
TODAY = date(2026, 10, 12)
SINCE = date(2026, 7, 14)


def sample(**changes):
    work = {
        "DOI": "10.1234/EXAMPLE", "type": "journal-article",
        "title": ["Photo-assisted zinc-ion batteries with a vanadium photocathode"],
        "published-online": {"date-parts": [[2026, 10, 10]]},
        "published-print": {"date-parts": [[2027, 1, 1]]},
        "author": [{"given": "Jane", "family": "Li"}],
        "container-title": ["Example & Energy"],
    }
    work.update(changes)
    return work


class DiscoveryTests(unittest.TestCase):
    def test_scope_with_unicode_hyphens_and_abbreviations(self):
        for title in (
            "Photo-assisted zinc-ion batteries", "Photo‐rechargeable Zinc‐Ion Batteries",
            "Photorechargeable Zn-ion batteries", "Light-driven zinc ion battery",
            "Constructing nanolaminates for photo-assisted Zn-ion storage",
        ):
            with self.subTest(title=title):
                self.assertTrue(monitor.relevant(title))

    def test_excludes_air_flow_capacitors_and_other_metals(self):
        for title in (
            "Photo-assisted zinc-air batteries", "Photo-assisted zinc-ion capacitors",
            "A photo-assisted zinc-ion redox flow battery", "Light-assisted lithium-ion battery",
            "Zinc-ion battery using a photo-catalyst", "Photo-assisted hydrogen production using ZnO",
        ):
            with self.subTest(title=title):
                self.assertFalse(monitor.relevant(title))

    def test_online_date_wins_over_future_issue_date(self):
        paper = monitor.crossref_paper(sample(), TODAY, SINCE)
        self.assertEqual(paper["publication_date"], "2026-10-10")
        self.assertEqual(paper["doi"], "10.1234/example")
        self.assertEqual(paper["citationAuthors"], ["Li, Jane"])
        self.assertEqual(paper["review_status"], "auto")

    def test_old_future_retracted_and_invalid_doi_are_rejected(self):
        variants = [
            {"published-online": {"date-parts": [[2020, 10, 10]]}},
            {"published-online": {"date-parts": [[2027, 10, 10]]}},
            {"DOI": "not-a-doi"}, {"subtype": "retraction"},
            {"relation": {"is-retracted-by": [{"id": "10.1234/retraction"}]}},
        ]
        for changes in variants:
            with self.subTest(changes=changes):
                self.assertIsNone(monitor.crossref_paper(sample(**changes), TODAY, SINCE))

    def test_missing_fields_do_not_fabricate_metadata(self):
        paper = monitor.crossref_paper(sample(author=[], **{"container-title": []}), TODAY, SINCE)
        self.assertEqual(paper["authors"], [])
        self.assertEqual(paper["journal"], "")
        self.assertEqual(paper["pages"], "")

    def test_merge_deduplicates_doi_and_preserves_curated_records(self):
        library = json.loads((ROOT / "literature.json").read_text())
        state = {"pending": [], "last_checked_at": None}
        original = copy.deepcopy(library)
        paper = monitor.crossref_paper(sample(), TODAY, SINCE)
        updated, updated_state, added = monitor.merge(library, state, [paper, paper], NOW)
        self.assertEqual(len(added), 1)
        self.assertEqual(len(updated_state["pending"]), 1)
        self.assertEqual(updated["papers"][:len(original["papers"])], original["papers"])
        self.assertEqual(library, original)
        again, _, added_again = monitor.merge(updated, updated_state, [paper], NOW)
        self.assertEqual(added_again, [])
        self.assertEqual(again["papers"], updated["papers"])

    @patch.object(monitor, "get_crossref")
    def test_missed_runs_extend_the_index_window(self, fetch):
        fetch.return_value = {"message": {"items": []}}
        config = json.loads((ROOT / "automation/config.json").read_text())
        monitor.discover(config, {"last_checked_at": "2026-08-01T00:17:00+00:00"}, NOW)
        from urllib.parse import unquote
        self.assertIn("from-index-date:2026-07-31", unquote(fetch.call_args[0][0]))
        self.assertIn("select=DOI%2Ctype", fetch.call_args[0][0])

    def test_incomplete_crossref_transfer_retries_then_succeeds(self):
        payload = io.BytesIO(b'{"status":"ok","message":{"items":[]}}')
        with patch.object(monitor.urllib.request, "urlopen",
                          side_effect=[http.client.IncompleteRead(b"partial"), payload]) as fetch, \
             patch.object(monitor.time, "sleep") as sleep:
            result = monitor.get_crossref("https://api.crossref.org/works?rows=1")
        self.assertEqual(result["message"]["items"], [])
        self.assertEqual(fetch.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_repeated_incomplete_transfer_fails_cleanly(self):
        with patch.object(monitor.urllib.request, "urlopen",
                          side_effect=[http.client.IncompleteRead(b"partial") for _ in range(3)]) as fetch, \
             patch.object(monitor.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "Crossref 连接失败"):
                monitor.get_crossref("https://api.crossref.org/works?rows=1")
        self.assertEqual(fetch.call_count, 3)


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.print_patch = patch("builtins.print")
        self.print_patch.start()
        self.addCleanup(self.print_patch.stop)
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "automation").mkdir()
        for name in ("index.html", "literature.html", "literature.json", "REFERENCES.md", "references.bib", "references.ris",
                     "automation/config.json", "automation/monitor-state.json"):
            shutil.copyfile(ROOT / name, self.root / name)
        # Tests must be independent of the real monitor's most recent run.
        state = {"version": 1, "pending": [], "last_checked_at": None,
                 "last_digest_date": None, "last_delivery_at": None}
        monitor.write_json(self.root / "automation/monitor-state.json", state)
        self.paper = monitor.crossref_paper(sample(), TODAY, SINCE)

    def state(self):
        return json.loads((self.root / "automation/monitor-state.json").read_text())

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}

    def refresh(self):
        with patch.object(monitor, "discover", return_value=[self.paper]):
            monitor.refresh(self.root, NOW)

    def test_dry_run_does_not_write_files(self):
        before = self.snapshot()
        with patch.object(monitor, "discover", return_value=[self.paper]):
            monitor.refresh(self.root, NOW, dry_run=True)
        self.assertEqual(before, self.snapshot())

    def test_search_failure_preserves_site_and_cursor(self):
        before = self.snapshot()
        with patch.object(monitor, "discover", side_effect=RuntimeError("unavailable")):
            with self.assertRaises(RuntimeError):
                monitor.refresh(self.root, NOW)
        self.assertEqual(before, self.snapshot())

    def test_refresh_keeps_html_data_and_exports_in_sync(self):
        self.refresh()
        library = json.loads((self.root / "literature.json").read_text())
        page = (self.root / "literature.html").read_text()
        embedded = json.loads(re.search(r'<script id="literature-data" type="application/json">(.*?)</script>', page, re.S)[1])
        self.assertEqual(embedded, library["papers"])
        self.assertEqual(len(library["papers"]), page.count('class="paper" id="paper-'))
        self.assertEqual(len(library["papers"]), (self.root / "references.bib").read_text().count("@article{"))
        self.assertEqual(len(library["papers"]), (self.root / "references.ris").read_text().count("TY  - JOUR"))
        renderer.render(self.root, library, check=True)

    def test_refresh_updates_home_counts_without_recreating_the_long_page(self):
        another = {**self.paper, "doi": "10.1234/other-metal", "battery_category": "other-metals"}
        with patch.object(monitor, "discover", return_value=[self.paper, another]):
            monitor.refresh(self.root, NOW)
        papers = json.loads((self.root / "literature.json").read_text())["papers"]
        home = (self.root / "index.html").read_text()
        total = re.search(r'<strong\b[^>]*data-paper-count[^>]*>(\d+)</strong>', home)
        self.assertEqual(int(total[1]), len(papers))
        for category in ("zinc", "other-metals"):
            count = re.search(rf'<strong\b[^>]*data-system-count="{category}"[^>]*>(\d+)</strong>', home)
            expected = sum(p.get("battery_category", "zinc") == category for p in papers)
            self.assertEqual(int(count[1]), expected)
        self.assertNotIn('class="paper" id="paper-', home)
        self.assertNotIn('id="paper-list"', home)
        self.assertNotIn('id="literature-data"', home)
        renderer.render(self.root, json.loads((self.root / "literature.json").read_text()), check=True)

    def test_html_and_embedded_json_escape_external_metadata(self):
        self.paper["title"] = 'Photo-assisted zinc-ion battery </script><img src=x onerror="alert(1)">'
        self.refresh()
        page = (self.root / "literature.html").read_text()
        self.assertNotIn('<img src=x', page)
        self.assertIn(r'\u003c/script>', page)

    def test_preparing_email_does_not_consume_pending(self):
        self.refresh()
        before = self.state()
        digest = monitor.email_digest(self.root, NOW)
        self.assertEqual(before, self.state())
        self.assertEqual(digest["dois"], [self.paper["doi"]])
        self.assertIn("https://doi.org/10.1234/example", digest["html"])

    def test_wrong_digest_id_keeps_pending(self):
        self.refresh()
        before = self.state()
        with self.assertRaises(ValueError):
            monitor.acknowledge_email(self.root, NOW, "incorrect")
        self.assertEqual(before, self.state())

    def test_confirmed_send_acknowledges_and_prevents_same_day_repeat(self):
        self.refresh()
        digest = monitor.email_digest(self.root, NOW)
        self.assertTrue(monitor.acknowledge_email(self.root, NOW, digest["digest_id"]))
        self.assertEqual(self.state()["pending"], [])
        self.assertEqual(self.state()["last_digest_date"], "2026-10-12")
        self.assertIsNone(monitor.email_digest(self.root, NOW))

    def test_stale_scan_does_not_prepare_a_false_empty_digest(self):
        self.refresh()
        tomorrow = NOW.replace(day=13)
        with self.assertRaises(ValueError):
            monitor.email_digest(self.root, tomorrow)

    def test_notification_limit_preserves_overflow(self):
        config = json.loads((self.root / "automation/config.json").read_text())
        config["max_notifications"] = 1
        monitor.write_json(self.root / "automation/config.json", config)
        another = {**self.paper, "doi": "10.1234/another", "url": "https://doi.org/10.1234/another"}
        with patch.object(monitor, "discover", return_value=[self.paper, another]):
            monitor.refresh(self.root, NOW)
        digest = monitor.email_digest(self.root, NOW)
        monitor.acknowledge_email(self.root, NOW, digest["digest_id"])
        self.assertEqual(self.state()["pending"], ["10.1234/another"])

    def test_exclusion_list_applies_to_already_pending_papers(self):
        self.refresh()
        config = json.loads((self.root / "automation/config.json").read_text())
        config["exclude_dois"] = [self.paper["doi"]]
        monitor.write_json(self.root / "automation/config.json", config)
        digest = monitor.email_digest(self.root, NOW)
        self.assertNotIn(self.paper["title"], digest["html"])
        monitor.acknowledge_email(self.root, NOW, digest["digest_id"])
        self.assertEqual(self.state()["pending"], [])

    def test_site_only_scan_does_not_leave_an_email_queue(self):
        with patch.object(monitor, "discover", return_value=[self.paper]):
            monitor.refresh(self.root, NOW, site_only=True)
        self.assertEqual(self.state()["pending"], [])


class WebsiteContentTests(unittest.TestCase):
    def test_aqueous_sodium_is_website_only_and_filterable(self):
        library = json.loads((ROOT / "literature.json").read_text())
        sodium = [p for p in library["papers"] if "aqueous-sodium" in p["tags"]]
        self.assertEqual(len(sodium), 6)
        self.assertEqual({p["id"] for p in sodium}, {f"L{i}" for i in range(87, 93)})
        self.assertTrue(all(p["battery_category"] == "other-metals" for p in sodium))
        self.assertTrue(all(p["metal_system"] == "sodium" for p in sodium))
        self.assertIn(("aqueous-sodium", "水系钠电"), renderer.TOPICS)
        self.assertFalse(monitor.relevant("Aqueous sodium-ion batteries"))

    def test_photocharging_conditions_link_to_existing_papers(self):
        page = (ROOT / "principles.html").read_text()
        paper_ids = {p["id"] for p in json.loads((ROOT / "literature.json").read_text())["papers"]}
        section = page.split('id="charge-conditions"', 1)[1].split('</section>', 1)[0]
        self.assertIn("hν ≥ E<sub>g</sub>", section)
        self.assertIn("导带 CB", section)
        self.assertIn("价带 VB", section)
        self.assertIn("非按比例绘制", section)
        self.assertTrue({"L01", "L03", "L04", "L06"}.issubset(paper_ids))
        for paper_id in ("L01", "L03", "L04", "L06"):
            self.assertIn(f'paper-{paper_id}', section)


if __name__ == "__main__":
    unittest.main()
