import importlib.util
import json
import math
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('render_bands',ROOT/'scripts/render_bands.py')
renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)

class BandDataTests(unittest.TestCase):
    def setUp(self): self.data=json.loads((ROOT/'bands-data.json').read_text(encoding='utf8'))
    def test_records_have_traceable_conditions_and_no_private_paths(self):
        ids=[]
        for r in self.data['records']:
            ids.append(r['id'])
            for k in ['material','sample','phase','method','edge_label','charge_label']: self.assertTrue(r[k])
            for k in ['doi','url','title','locator']: self.assertTrue(r['source'][k])
            for k in ['cb','vb','gap_eV','work_function_eV','d_band_center_eV']:
                self.assertTrue(r[k] is None or isinstance(r[k],(int,float)) and math.isfinite(r[k]))
            self.assertEqual(r['cb'] is None,r['vb'] is None)
            if r['cb'] is not None:
                self.assertIn(r['scale'],['vacuum','NHE','SHE'])
                self.assertLess(r['vb'],r['cb']) if r['scale']=='vacuum' else self.assertLess(r['cb'],r['vb'])
        self.assertEqual(len(ids),len(set(ids)))
        serialized=json.dumps(self.data)
        for secret in ['xwechat_files','localPdf','localFigurePage','C:/','C:\\\\']: self.assertNotIn(secret,serialized)
    def test_distinct_electronic_quantities_stay_distinct(self):
        for r in self.data['records']:
            if r['work_function_eV'] is not None or r['d_band_center_eV'] is not None:
                self.assertIsNone(r['cb']);self.assertIsNone(r['vb']);self.assertIsNone(r['gap_eV'])
        byid={r['id']:r for r in self.data['records']}
        self.assertEqual(byid['V-V2O5-2020']['edge_basis'],'author_schematic')
        self.assertIsNone(byid['V-KVOH-2025']['gap_eV'])
        self.assertIsNone(byid['V-V2O5-VO2-2025']['cb'])
        self.assertIsNone(byid['P-SNO2-QD-AS2024']['cb'])
    def test_generated_catalog_matches_and_is_script_safe(self):
        page=(ROOT/'bands.html').read_text(encoding='utf8')
        self.assertEqual(page,renderer.render(page,self.data))
        payload=re.search(r'<script id="bands-data" type="application/json">(.*?)</script>',page,re.S)[1]
        self.assertEqual(json.loads(payload),self.data)
        hostile=json.loads(json.dumps(self.data));hostile['records'][0]['material']='</script><img onerror=alert(1)>'
        output=renderer.render(page,hostile)
        self.assertNotIn('</script><img',output)
        self.assertIn('&lt;/script&gt;&lt;img',output)

if __name__=='__main__': unittest.main()
