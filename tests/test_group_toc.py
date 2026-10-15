import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import render_library as renderer


class GroupTOCTests(unittest.TestCase):
    def test_nested_cards_are_replaced_without_retaining_old_cards(self):
        page='<div id="group-photo"><article><div>old TOC</div><div>old text</div></article></div><footer>end</footer>'
        self.assertEqual(renderer.replace_content(page,'div','group-photo','new cards'),'<div id="group-photo">new cards</div><footer>end</footer>')

    def test_daily_render_preserves_toc_images_and_sources(self):
        library=json.loads((ROOT/'literature.json').read_text(encoding='utf-8'))
        toc=json.loads((ROOT/'group-toc.json').read_text(encoding='utf-8'))['papers']
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in ('index.html','literature.html','group.html','group-toc.json','REFERENCES.md','references.bib','references.ris'):
                shutil.copyfile(ROOT/name,root/name)
            extra=copy.deepcopy(library['papers'][0])
            extra.update(id='L9999',doi='10.1234/future',group_collection=False)
            library['papers'].append(extra)
            markup=renderer.generated_files(root,library)['group.html']
        for paper_id,record in toc.items():
            self.assertIn(f'id="group-{paper_id}"',markup)
            self.assertIn(record['source'].replace('&','&amp;'),markup)
            if record.get('image'):
                self.assertIn(f'src="{record["image"]}"',markup)
                self.assertTrue((ROOT/record['image']).is_file())
        self.assertEqual(markup.count('data-toc-open'),sum(bool(r.get('image')) for r in toc.values()))
        self.assertNotIn('group-L9999',markup)

    def test_wrong_paper_image_mapping_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'DOI 不匹配'):
            renderer.toc_figure({'id':'L07','doi':'10.1039/d6ta03521c'},{'doi':'10.1234/wrong','source':'https://example.com'})


if __name__=='__main__':
    unittest.main()
