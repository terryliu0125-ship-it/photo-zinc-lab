"""Render a dated, source-scoped audit snapshot; never auto-certify new papers."""
from __future__ import annotations

import argparse
import html
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COVERAGE = {
    "abstract-based": "原始摘要",
    "abstract-fragment": "原始摘要相关片段",
    "abstract-plus-selected-SI": "原始摘要与指定 SI 段落",
    "selected-main-text": "相关正文 / 图表 / 方法",
    "fulltext-relevant-sections": "所提供正文的相关章节",
    "review-scope": "综述范围与导读边界",
    "editorial-screen-only": "原始来源待核",
    "metadata-only": "仅书目，机理待核",
}


def esc(value):
    return html.escape(str(value), quote=True)


def source_links(urls):
    return " · ".join(
        f'<a href="{esc(u)}" target="_blank" rel="noopener noreferrer">依据 {i+1} ↗</a>'
        for i, u in enumerate(urls) if isinstance(u, str) and u.startswith("https://")
    )


def render(data):
    papers = data["papers"]
    checked = sum(p["audit"]["status"] == "confirmed" for p in papers)
    pending = len(papers) - checked
    levels = Counter(p["audit"]["coverage"] for p in papers)
    nav = [("index.html", "首页"), ("principles.html", "光辅助原理"),
           ("literature.html", "文献库"), ("vanadium.html", "钒基专题"),
           ("bands.html", "能带比较"), ("group.html", "课题组成果"), ("guide.html", "阅读指南")]
    navigation = "".join(f'<a href="{u}">{t}</a>' for u, t in nav)
    findings = "".join(
        f'<article class="audit-finding" id="{esc(f["id"])}"><span class="audit-label">{esc(f["category"])}</span>'
        f'<h3>{esc(f["title"])}</h3><p>{esc(f["conclusion"])}</p>'
        f'<p class="audit-previous">原表述的风险：{esc(f["before"])}</p>'
        f'<p class="audit-source">{source_links(f["sources"])} · <a href="{esc(f["page"])}">查看修订页面 →</a></p></article>'
        for f in data["findings"]
    )
    formulas = "".join(f'<tr><th scope="row">{esc(f["name"])}</th><td><code>{esc(f["formula"])}</code></td><td>{esc(f["conditions"])}</td></tr>' for f in data["formulas"])
    band_rows = "".join(
        f'<tr><th scope="row"><a href="bands.html#source-{esc(r["id"])}">{esc(r["material"])}</a></th>'
        f'<td>{esc(r["state"])}</td><td>{esc(r["conclusion"])}</td></tr>' for r in data["bands"]
    )
    paper_rows = []
    for p in papers:
        a = p["audit"]
        label = "所读范围内相符" if a["status"] == "confirmed" else "原始证据待核"
        paper_rows.append(
            f'<tr id="audit-{esc(p["id"])}"><th scope="row"><a href="literature.html#paper-{esc(p["id"])}">{esc(p["id"])}</a></th>'
            f'<td><span class="audit-status {"scoped" if a["status"] == "confirmed" else "pending"}">{label}</span>'
            f'<small>{esc(COVERAGE.get(a["coverage"], a["coverage"]))}</small></td>'
            f'<td><details><summary>{esc(p["title"])}</summary><p>{esc(a["note"])}</p>'
            f'<p>{esc(a.get("locator", ""))}</p><p>{source_links(a.get("source_urls", []))}</p></details></td></tr>'
        )
    level_text = "；".join(f'{COVERAGE.get(k, k)} {v} 篇' for k, v in sorted(levels.items()))
    html_page = f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>理论核查记录 · 光锌能源实验室</title><meta name="description" content="光辅助电池理论、能带换算与文献导读的分层核查记录，明确证据范围和仍待核实的内容。"/>
<link rel="stylesheet" href="site.css?v=20261015-bands1"/><link rel="stylesheet" href="theory-audit.css?v=20261023-1"/></head>
<body><a class="skip-link" href="#main-content">跳转到主要内容</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">↯</span><span><strong>光锌能源实验室</strong><small>PHOTO–ZINC LAB</small></span></a><nav class="site-nav" aria-label="主导航">{navigation}</nav></div></header>
<main class="page-shell audit-page" id="main-content"><div class="breadcrumb" aria-label="当前位置"><a href="index.html">首页</a><span aria-hidden="true">/</span><span aria-current="page">理论核查记录</span></div>
<section class="audit-intro"><span class="kicker">THEORY · SOURCES · LIMITS</span><h1>让每一个机理判断，<br/>都有可追溯的依据。</h1><p class="audit-lede">本轮核查覆盖七个页面的理论文字与图示、22 条能带样品和 {len(papers)} 篇文献导读。已修订容易被当成普适结论的表述；换算式与电子流向按统一约定复核。</p>
<p>核查快照：<time datetime="{esc(data["checked_on"])}">{esc(data["checked_on"])}</time>。这是一份证据范围记录，不是对全部论文实验与理论的独立复现。之后自动新增的论文须另行核对。</p>
<div class="audit-stats"><div><strong>{len(papers)}</strong><span>逐篇扫读并登记</span></div><div><strong>{checked}</strong><span>核到原始来源相应范围</span></div><div><strong>{pending}</strong><span>仍需补充原始证据</span></div><div><strong>22</strong><span>样品逐条检查</span></div></div>
<nav class="audit-jumps" aria-label="核查目录"><a href="#corrections">关键修订</a><a href="#formulas">公式与约定</a><a href="#band-audit">能带证据</a><a href="#library-audit">逐篇导读台账</a><a href="THEORY_AUDIT.md">下载文字报告 ↗</a></nav></section>
<section class="audit-section" id="corrections"><span class="kicker">WHAT CHANGED</span><h2>需要说清楚的理论边界</h2><div class="audit-findings">{findings}</div></section>
<section class="audit-section" id="formulas"><span class="kicker">SAME COORDINATE, EXPLICIT CONDITIONS</span><h2>公式正确，还要满足使用条件</h2><p>以下电位均按还原电势约定。充电是反应逆向运行，不把平衡电势直接取反。真空电子能量与电极电位的轴向相反。</p><div class="audit-table-wrap"><table><caption>复核后保留的换算与能量表达式</caption><thead><tr><th>用途</th><th>表达式</th><th>使用条件</th></tr></thead><tbody>{formulas}</tbody></table></div><p class="audit-source">参照：{source_links(data["formula_sources"])}</p></section>
<section class="audit-section" id="band-audit"><span class="kicker">22 SAMPLE RECORDS</span><h2>可换算，不等于完整实测</h2><p>14 条具备可统一的带边对，4 条仍缺绝对带边或参比条件，4 条仅为功函数 / d 带中心参考。14 条包含作者示意和 UPS/光学推导值，均保留方法与限制；没有把它们升级成材料通用常数。未改动原始样品数字。</p><div class="audit-table-wrap"><table><caption>逐样品的证据边界；完整文献和合成定位见样品链接</caption><thead><tr><th>样品</th><th>状态</th><th>核查结论</th></tr></thead><tbody>{band_rows}</tbody></table></div></section>
<section class="audit-section" id="library-audit"><span class="kicker">SOURCE-SCOPED READING</span><h2>逐篇导读，核到了哪里</h2><p>{esc(level_text)}。</p><p>“所读范围内相符”仅指本站导读与列明来源相符。摘要核对不能证明摘要外的因果关系、全部 SI、DFT 设置或原始数据；“待核”也不代表论文错误。每篇卡片的“阅读提示与书目信息”保留同样记录。</p><div class="audit-table-wrap"><table class="audit-paper-table"><caption>{len(papers)} 篇导读核查快照；展开题目查看原文位置与限制</caption><thead><tr><th>ID</th><th>范围 / 状态</th><th>文章与核查说明</th></tr></thead><tbody>{"".join(paper_rows)}</tbody></table></div></section>
<aside class="audit-limits"><h2>还需要补的证据</h2><p>所有待核条目、未读 SI 和仅摘要支持的机理细节都保留在台账中。公众号内容仍未核对，未把它作为理论来源。本轮没有重新测量能带、重算 DFT 或复现实验；评估你们的新样品仍需实际晶相、荷电态、电解液和光照条件。</p><p><a href="literature.html">回到文献库 →</a> · <a href="bands.html">研判能带与反应电位 →</a></p></aside></main>
<footer class="site-footer"><span>© 2026 PHOTO–ZINC LAB · 光能与电化学储能</span><div class="footer-links"><a href="THEORY_AUDIT.md">文字报告</a><a href="https://github.com/terryliu0125-ship-it/photo-zinc-lab/issues" target="_blank" rel="noopener noreferrer">提交更正 ↗</a></div></footer><script src="site.js?v=20261013-pages1" defer></script></body></html>
'''
    markdown = [f'# 理论核查记录（{data["checked_on"]}）', '',
                f'覆盖七页理论文字与图示、22 条能带记录、{len(papers)} 篇导读。{checked} 篇核到原始来源相应范围；{pending} 篇仍待补原始证据。', '',
                '核查状态仅描述本站导读与所读来源的关系，不代表全文、实验或计算被独立证明。自动新增论文不继承这个快照的核查状态。', '', '## 关键修订', '']
    for f in data["findings"]:
        markdown.extend([f'### {f["title"]}', '', f['conclusion'], '', '依据：' + '；'.join(f'[{u}]({u})' for u in f['sources']), ''])
    markdown.extend(['## 换算与条件', ''])
    for f in data['formulas']:
        markdown.extend([f'- {f["name"]}：`{f["formula"]}`。{f["conditions"]}', ''])
    markdown.extend(['## 逐篇导读核查', '', f'{level_text}。', ''])
    for p in papers:
        a = p['audit']
        markdown.extend([f'### {p["id"]} · {p["title"]}', '', f'读取范围：{COVERAGE.get(a["coverage"], a["coverage"])}；状态：{a["status"]}。', '', a['note'], '', a.get('locator',''), '', '；'.join(f'[依据]({u})' for u in a.get('source_urls', [])), ''])
    return {'theory-audit.html': html_page, 'THEORY_AUDIT.md': '\n'.join(markdown).rstrip()+'\n'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = json.loads((ROOT/'theory-audit-data.json').read_text(encoding='utf8'))
    for name, text in render(data).items():
        path = ROOT/name
        if args.check:
            if not path.exists() or path.read_text(encoding='utf8') != text:
                raise SystemExit(f'{name} needs regeneration')
        else:
            path.write_text(text, encoding='utf8')
    print('Theory audit snapshot matches.' if args.check else 'Rendered theory audit snapshot.')


if __name__ == '__main__':
    main()
