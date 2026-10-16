import importlib.util
import json
import math
from pathlib import Path
import re
import subprocess
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
                self.assertIn(r['scale'],['vacuum','NHE','SHE','RHE','AgAgCl','SCE','Zn'])
                self.assertLess(r['vb'],r['cb']) if r['scale']=='vacuum' else self.assertLess(r['cb'],r['vb'])
        self.assertEqual(len(ids),len(set(ids)))
        serialized=json.dumps(self.data)
        for secret in ['xwechat_files','localPdf','localFigurePage','C:/','C:\\\\']: self.assertNotIn(secret,serialized)
    def test_distinct_electronic_quantities_stay_distinct(self):
        for r in self.data['records']:
            if r.get('band_data_status')=='context_only':
                self.assertIsNone(r['cb']);self.assertIsNone(r['vb']);self.assertIsNone(r['gap_eV'])
                self.assertTrue(r['work_function_eV'] is not None or r['d_band_center_eV'] is not None)
        byid={r['id']:r for r in self.data['records']}
        self.assertEqual(byid['V-V2O5-2020']['edge_basis'],'author_schematic')
        self.assertIsNone(byid['V-KVOH-2025']['gap_eV'])
        self.assertIsNone(byid['V-V2O5-VO2-2025']['cb'])
        self.assertIsNone(byid['P-SNO2-QD-AS2024']['cb'])
        for rid in ['T-V6O13-2026','T-K05V6O13-2026','T-VOH-2026','T-BMIMVOH-2026']:
            self.assertEqual(byid[rid]['band_data_status'],'context_only')
    def test_upstream_UPS_context_can_only_derive_edges_with_same_sample_onset_and_gap(self):
        for r in self.data['records']:
            if r.get('edge_basis')=='derived_vacuum_from_same_sample_UPS_and_optical_gap':
                self.assertEqual(r['scale'],'vacuum')
                self.assertAlmostEqual(r['cb'],r['raw_cb_relative_EF']-r['work_function_eV'])
                self.assertAlmostEqual(r['vb'],r['raw_vb_relative_EF']-r['work_function_eV'])
                self.assertAlmostEqual(r['cb']-r['vb'],r['gap_eV'])
                self.assertTrue(r.get('derived'))
    def test_static_and_interactive_coordinates_agree_for_every_record(self):
        script="const C=require('./band-core.js');const records=JSON.parse(require('node:fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(records.map(r=>C.normalize(r))))"
        result=subprocess.run(['node','-e',script],input=json.dumps(self.data['records']),text=True,capture_output=True,cwd=ROOT,check=True)
        for r,n in zip(self.data['records'],json.loads(result.stdout)):
            edges=renderer.normalized_edges(r)
            self.assertEqual(edges is not None,n['ok'],r['id'])
            if edges:
                self.assertAlmostEqual(edges[0],n['cb'],msg=r['id'])
                self.assertAlmostEqual(edges[1],n['vb'],msg=r['id'])
        self.assertIsNone(renderer.normalized_edges({'cb':0,'vb':2,'scale':'RHE'}))
        self.assertIsNone(renderer.normalized_edges({'cb':0,'vb':2,'scale':'Zn'}))
        self.assertEqual(renderer.normalized_edges({'cb':0,'vb':2,'scale':'Zn','zinc_reference_mode':'standard_approximation'}),(-.76,1.24))
    def test_each_sample_has_separate_band_and_synthesis_sources(self):
        for r in self.data['records']:
            s=r['source'];syn=r['synthesis']
            for key in ['title_zh','reference','authors','journal','year']: self.assertTrue(s[key],(r['id'],key))
            self.assertIn(s['doi'],s['reference'])
            self.assertIn(s['title'],s['reference'])
            self.assertIn(syn['status'],['verified_summary','partial','unavailable'])
            for key in ['route','locator','phase_check','missing']: self.assertTrue(syn[key],(r['id'],key))
            if syn['status']=='verified_summary': self.assertTrue(syn['conditions'])
            self.assertNotEqual(s['locator'],syn['locator'])
            self.assertNotIn('xwechat_files',json.dumps(syn))
        byid={r['id']:r for r in self.data['records']}
        self.assertIn('520 min',' '.join(byid['V-VO2B-2021-rGO']['synthesis']['conditions']))
        self.assertEqual(byid['V-VO2B-2021-ZnO']['synthesis']['conditions'],[])
        self.assertNotEqual(byid['T-VOH-2026']['synthesis']['precursors'],byid['T-BMIMVOH-2026']['synthesis']['precursors'])
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
