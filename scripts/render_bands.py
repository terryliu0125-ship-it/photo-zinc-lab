"""Embed the public band catalog for offline use and no-JavaScript reading."""
import argparse
import html
import json
import math
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def normalized_edges(record):
    """Static catalog uses the same 25 C coordinate convention as BandCore."""
    if record.get('band_data_status') == 'context_only': return None
    if record.get('cb') is None or record.get('vb') is None: return None
    scale=record.get('scale')
    def convert(value):
        value=float(value)
        if not math.isfinite(value): raise ValueError('Nonfinite band value')
        if scale=='vacuum': return -value-4.44
        if scale in ['SHE','NHE']: return value
        if scale=='RHE':
            if record.get('ph') is None: raise ValueError('RHE needs pH')
            return value-0.059159349684781114*float(record['ph'])
        if scale in ['AgAgCl','SCE','Zn']:
            offset=record.get('reference_offset_V')
            if offset is None and scale=='Zn' and record.get('zinc_reference_mode')=='standard_approximation': offset=-0.76
            if offset is None: raise ValueError('Reference needs explicit offset')
            return value+float(offset)
        raise ValueError('Unsupported reference')
    try:
        cb,vb=convert(record['cb']),convert(record['vb'])
        if not math.isfinite(cb) or not math.isfinite(vb) or cb>=vb: return None
        return cb,vb
    except (ValueError,TypeError,OverflowError): return None

def coordinate_table(edges):
    if edges is None: return ''
    cb,vb=edges
    rows=[('统一主标尺 · V vs SHE',cb,vb),('真空电子能量 · eV',-cb-4.44,-vb-4.44),('V vs Zn° · 标准态近似',cb+0.76,vb+0.76)]
    body=''.join(f'<tr><th scope="row">{esc(label)}</th><td>{a:.3f}</td><td>{b:.3f}</td></tr>' for label,a,b in rows)
    return f'<div class="band-conversion-table"><table><caption>同一样品的三种参照</caption><thead><tr><th>参照标尺</th><th>CB</th><th>VB</th></tr></thead><tbody>{body}</tbody></table><p class="conversion-note">Zn°仅按−0.76 V vs SHE的25°C标准态近似换算，不代表实际电解液中的Zn参比；坐标统一不消除pH、晶相和荷电态差异。</p></div>'

def esc(value):
    return html.escape(str(value), quote=True)

def anchor(url, label):
    if not isinstance(url,str) or urlsplit(url).scheme not in ['http','https']: return ''
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)} ↗</a>'

def synthesis_html(r):
    syn=r['synthesis']
    label={'verified_summary':'主要步骤已核 · 非完整复现规程','partial':'仅部分信息 · 缺项待补','unavailable':'方法待补'}[syn['status']]
    def items(values): return '<ul>'+''.join(f'<li>{esc(v)}</li>' for v in values)+'</ul>' if values else '<p>尚未核实，不推测补齐。</p>'
    si=anchor(syn.get('supplement_url'),'补充信息（已核读）' if syn.get('supplement_checked') else '补充信息入口（内容待核）') or '<span>补充信息入口或内容待补，请在期刊页面查找 Supporting Information / ESI。</span>'
    return f'''<div class="source-synthesis"><h4>合成方法与复现缺项</h4><p><strong>{esc(label)}</strong></p><p>{esc(syn['route'])}</p><h5>原料与前驱体</h5>{items(syn['precursors'])}<h5>已核条件</h5>{items(syn['conditions'])}<p><strong>合成章节定位：</strong>{esc(syn['locator'])}</p><p><strong>相与组成确认：</strong>{esc(syn['phase_check'])}</p><h5>复现前待补</h5>{items(syn['missing'])}{items(syn['notes'])}<p>{si}</p><p>路线摘要不能保证获得相同带边；完整用量、设备程序及后处理仍需回原文/SI核对。</p></div>'''

def render_catalog(data):
    rows=[]
    for r in data['records']:
        unit='eV（真空）' if r['scale']=='vacuum' else 'V vs '+str(r['scale'])
        original=f"CB {r['cb']:g} / VB {r['vb']:g} {unit}" if r['cb'] is not None and r['vb'] is not None else ''
        edges=normalized_edges(r)
        pair=f"CB {edges[0]:.3f} / VB {edges[1]:.3f} V vs SHE" if edges else ('电子参数参考 · 不作为半导体CB/VB' if r.get('band_data_status')=='context_only' else 'CB / VB：尚缺可对齐的绝对带边')
        gap=f"Eg {r['gap_eV']:g} eV" if r['gap_eV'] is not None else 'Eg 待补'
        extra=''
        if r['work_function_eV'] is not None: extra=f" · 功函数 Φ {r['work_function_eV']:g} eV（不是CB/VB）"
        if r['d_band_center_eV'] is not None: extra=f" · d带中心 {r['d_band_center_eV']:g} eV（费米相对值，不是CB/VB）"
        s=r['source']
        notes=''.join(f'<li>{esc(n)}</li>' for n in r['notes'])
        rows.append(f'''<article class="band-source-record" id="source-{esc(r['id'])}">
<h3>{esc(r['material'])}</h3><p>{esc(pair)} · {esc(gap)}{esc(extra)}</p><p>{esc('原始带边：'+original) if original else ''}</p>
<p><strong>{esc(r['edge_label'])}</strong> · {esc(r['charge_label'])}</p>
<p>{esc(s['title_zh'])} · {esc(s['journal'])} ({s['year']})</p>
<details><summary>能带参考文献与合成方法</summary>{coordinate_table(edges)}<h4>能带文献依据</h4><p>{esc(s['reference'])}</p><dl><dt>晶相 / 样品</dt><dd>{esc(r['phase'])}；{esc(r['sample'])}</dd><dt>能带方法</dt><dd>{esc(r['method'])}</dd><dt>pH / 荷电态</dt><dd>{r['ph'] if r['ph'] is not None else 'pH未核实'} / {esc(r['soc'] or '未完整报告')}</dd><dt>能带原文定位</dt><dd>{esc(s['locator'])}</dd></dl><ul>{notes}</ul><p>{anchor('https://doi.org/'+s['doi'],'原文 DOI')} · {anchor(s['url'],s['access_label'])}</p>{synthesis_html(r)}</details></article>''')
    return '\n'.join(rows)

def render(page, data):
    total=len(data['records'])
    context=sum(r.get('band_data_status')=='context_only' for r in data['records'])
    complete=sum(normalized_edges(r) is not None for r in data['records'])
    coverage=f'半导体与候选样品 {total-context} 条：{complete} 条可统一到SHE，{total-context-complete} 条待补带边或参比条件；另有 {context} 条电子参数参考，不计入完整率。'
    page=re.sub(r'(<span id="record-total">)\d+(</span>)',lambda m:m[1]+str(total)+m[2],page)
    page=re.sub(r'(<p id="band-coverage-stat" class="band-small">).*?(</p>)',lambda m:m[1]+coverage+m[2],page,flags=re.S)
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
