"""Embed the public band catalog for offline use and no-JavaScript reading."""
import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def esc(value):
    return html.escape(str(value), quote=True)

def render_catalog(data):
    rows=[]
    for r in data['records']:
        unit='eV（真空）' if r['scale']=='vacuum' else 'V vs '+str(r['scale'])
        pair=f"CB {r['cb']:g} / VB {r['vb']:g} {unit}" if r['cb'] is not None and r['vb'] is not None else 'CB / VB：尚缺可对齐的绝对带边'
        gap=f"Eg {r['gap_eV']:g} eV" if r['gap_eV'] is not None else 'Eg 待补'
        extra=''
        if r['work_function_eV'] is not None: extra=f" · 功函数 Φ {r['work_function_eV']:g} eV（不是CB/VB）"
        if r['d_band_center_eV'] is not None: extra=f" · d带中心 {r['d_band_center_eV']:g} eV（费米相对值，不是CB/VB）"
        s=r['source']
        notes=''.join(f'<li>{esc(n)}</li>' for n in r['notes'])
        rows.append(f'''<article class="band-source-record" id="source-{esc(r['id'])}">
<h3>{esc(r['material'])}</h3><p>{esc(pair)} · {esc(gap)}{esc(extra)}</p>
<p><strong>{esc(r['edge_label'])}</strong> · {esc(r['charge_label'])}</p>
<details><summary>查看晶相、方法与原文</summary><dl><dt>晶相 / 样品</dt><dd>{esc(r['phase'])}；{esc(r['sample'])}</dd><dt>方法</dt><dd>{esc(r['method'])}</dd><dt>pH / 荷电态</dt><dd>{r['ph'] if r['ph'] is not None else 'pH未核实'} / {esc(r['soc'] or '未完整报告')}</dd><dt>原文定位</dt><dd>{esc(s['locator'])}</dd></dl><ul>{notes}</ul><p><a href="https://doi.org/{esc(s['doi'])}" target="_blank" rel="noopener noreferrer">原文 DOI ↗</a> · <a href="{esc(s['url'])}" target="_blank" rel="noopener noreferrer">核验来源 ↗</a><br/>{esc(s['title'])}</p></details></article>''')
    return '\n'.join(rows)

def render(page, data):
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    page,n=re.subn(r'(<script id="bands-data" type="application/json">).*?(</script>)',lambda m:m[1]+payload+m[2],page,flags=re.S)
    if n!=1: raise ValueError('Expected one bands-data script')
    page,n=re.subn(r'(<!-- BAND_CATALOG_START -->).*?(<!-- BAND_CATALOG_END -->)',lambda m:m[1]+'\n'+render_catalog(data)+'\n'+m[2],page,flags=re.S)
    if n!=1: raise ValueError('Expected catalog markers')
    return page

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    data=json.loads((ROOT/'bands-data.json').read_text(encoding='utf8'))
    page=ROOT/'bands.html';original=page.read_text(encoding='utf8');result=render(original,data)
    if args.check:
        if result!=original: raise SystemExit('bands.html catalog needs regeneration')
        print('Band catalog and embedded data match.')
    else:
        page.write_text(result,encoding='utf8');print(f"Embedded {len(data['records'])} sample records.")

if __name__=='__main__': main()
