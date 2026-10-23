import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/f'{name}.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class TheoryAuditTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads((ROOT/'theory-audit-data.json').read_text(encoding='utf8'))

    def test_snapshot_preserves_scope_and_source_requirements(self):
        self.assertEqual(self.snapshot['checked_on'], '2026-10-23')
        ids = [p['id'] for p in self.snapshot['papers']]
        self.assertEqual(len(ids), len(set(ids)))
        current = json.loads((ROOT/'literature.json').read_text(encoding='utf8'))
        self.assertTrue(set(ids).issubset({p['id'] for p in current['papers']}))
        for p in self.snapshot['papers']:
            a = p['audit']
            self.assertTrue(a['note'])
            self.assertEqual(a['checked_on'], self.snapshot['checked_on'])
            if a['status'] == 'confirmed':
                self.assertNotIn(a['coverage'], ['editorial-screen-only', 'metadata-only'])
                self.assertTrue(a['source_urls'], p['id'])
                self.assertTrue(a['locator'], p['id'])
            for u in a['source_urls']:
                self.assertTrue(u.startswith('https://'), (p['id'], u))
        for private in ['xwechat_files', 'C:/Users/', 'C:\\Users\\']:
            self.assertNotIn(private, json.dumps(self.snapshot))

    def test_dated_report_is_reproducible_and_does_not_certify_new_entries(self):
        for name, text in module('render_theory_audit').render(self.snapshot).items():
            self.assertEqual((ROOT/name).read_text(encoding='utf8'), text, name)
        fallback = module('render_library').theory_audit_html({'id': 'future-automatic'})
        self.assertIn('待逐条核对', fallback)
        self.assertNotIn('相符', fallback)

    def test_every_band_sample_has_a_separate_audit_entry(self):
        bands = json.loads((ROOT/'bands-data.json').read_text(encoding='utf8'))['records']
        audited = self.snapshot['bands']
        self.assertEqual({r['id'] for r in bands}, {r['id'] for r in audited})
        self.assertEqual(len(audited), len(bands))
        for r in audited:
            self.assertTrue(r['conclusion'])
            self.assertTrue(r['state'])


if __name__ == '__main__':
    unittest.main()
