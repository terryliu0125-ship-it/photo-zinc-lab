"""Generate the static reading room and citations from literature.json."""

from __future__ import annotations

import argparse
import html
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TOPICS = (
    ("all", "全部"), ("auto", "自动收录"), ("review", "综述导读"),
    ("vanadium", "钒基材料"), ("heterojunction", "异质结"),
    ("mechanism", "机理与评价"), ("capacitor", "锌离子电容器"),
)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def bib_escape(value: object) -> str:
    replacements = {"\\": r"\textbackslash{}", "{": r"\{", "}": r"\}",
                    "&": r"\&", "%": r"\%", "_": r"\_", "$": r"\$", "#": r"\#"}
    return "".join(replacements.get(c, c) for c in str(value))


def bib_entry(paper: dict) -> str:
    fields = [
        ("title", "{" + bib_escape(paper["title"]) + "}"),
        ("author", " and ".join(bib_escape(a) for a in paper["citationAuthors"])),
        ("journal", bib_escape(paper["journal"])), ("year", str(paper["year"])),
    ]
    for name in ("volume", "issue"):
        if paper.get(name):
            fields.append(("number" if name == "issue" else name, bib_escape(paper[name])))
    if paper.get("pages"):
        pages = paper["pages"]
        fields.append(("pages" if re.fullmatch(r"\d+[-–]\d+", pages) else "eid",
                       bib_escape(re.sub(r"(?<=\d)[-–](?=\d)", "--", pages))))
    fields.extend((("doi", bib_escape(paper["doi"])), ("url", bib_escape(paper["url"]))))
    return "@article{PhotoZinc" + paper["id"] + ",\n" + ",\n".join(
        f"  {key} = {{{value}}}" for key, value in fields
    ) + "\n}"


def ris_entry(paper: dict) -> str:
    lines = ["TY  - JOUR", f"ID  - {paper['id']}", f"TI  - {paper['title']}"]
    lines.extend(f"AU  - {a}" for a in paper["authors"])
    lines.extend((f"JO  - {paper['journal']}", f"PY  - {paper['year']}"))
    if paper.get("volume"):
        lines.append(f"VL  - {paper['volume']}")
    if paper.get("issue"):
        lines.append(f"IS  - {paper['issue']}")
    if paper.get("pages"):
        pages = re.split("[-–]", paper["pages"], maxsplit=1)
        lines.append(f"SP  - {pages[0]}")
        if len(pages) == 2:
            lines.append(f"EP  - {pages[1]}")
    lines.extend((f"DO  - {paper['doi']}", f"UR  - {paper['url']}", "ER  -"))
    return "\n".join(lines)


def card(p: dict) -> str:
    authors = "; ".join(p["authors"][:3]) + ("; et al." if len(p["authors"]) > 3 else "")
    journal = " · ".join(str(value) for value in (p["journal"], p.get("publication_date") or p["year"]) if value)
    if p.get("volume") or p.get("pages"):
        journal += " · " + ": ".join(str(p[k]) for k in ("volume", "pages") if p.get(k))
    auto = p.get("review_status") == "auto"
    flag = '<span class="paper-kind automatic">自动收录 · 待研读</span>' if auto else ""
    abstract = f'<p class="paper-abstract" lang="en">{esc(p["abstract"])}</p>' if p.get("abstract") else ""
    related = " related" if p["kind"] == "关联器件" else ""
    return f'''<li class="paper" id="paper-{esc(p['id'])}" data-id="{esc(p['id'])}">
 <div class="paper-index"><span>{esc(p['id'])}</span><b>{esc(p['year'])}</b></div>
 <div class="paper-body">
  <div class="paper-flags">{flag}<span class="paper-kind{related}">{esc(p['kind'])}</span><span class="paper-material">{esc(p['material'])}</span></div>
  <h3><a href="{esc(p['url'])}" target="_blank" rel="noopener noreferrer">{esc(p['title'])}</a></h3>
  <p class="paper-journal">{esc(journal)}</p>
  <p class="paper-authors">{esc(authors)}</p>
  <p class="paper-summary"><strong>{esc(p['heading'])}</strong>{esc(p['summary'])}</p>
  <details><summary>阅读提示与书目信息</summary>
   <p>{esc(p['note'])}</p>{abstract}
   <p>完整作者：{esc('; '.join(p['authors']))}</p>
   <a href="{esc(p['source'])}" target="_blank" rel="noopener noreferrer">查看 Crossref 书目记录 ↗</a>
  </details>
  <span class="paper-doi">DOI: {esc(p['doi'])}</span>
 </div>
 <div class="paper-actions">
  <a class="doi-link" href="{esc(p['url'])}" target="_blank" rel="noopener noreferrer" aria-label="阅读 {esc(p['title'])} 原文">原文入口 <span aria-hidden="true">↗</span></a>
  <button class="copy-citation" type="button" data-copy="{esc(p['id'])}" aria-label="复制 {esc(p['id'])} 引文">复制引文</button>
 </div>
</li>'''


def replace_content(page: str, tag: str, element_id: str, content: str) -> str:
    pattern = rf'(<{tag}\b[^>]*\bid="{re.escape(element_id)}"[^>]*>).*?(</{tag}>)'
    updated, count = re.subn(pattern, lambda m: m[1] + content + m[2], page, flags=re.S)
    if count != 1:
        raise ValueError(f"页面缺少或重复生成区域：{element_id}")
    return updated


def generated_files(root: Path, library: dict) -> dict[str, str]:
    papers = library["papers"]
    ids = [p["id"] for p in papers]
    dois = [p["doi"].casefold() for p in papers]
    if len(set(ids)) != len(ids) or len(set(dois)) != len(dois):
        raise ValueError("文献编号或 DOI 重复，停止生成")
    if any(not re.fullmatch(r"L\d+", item) for item in ids):
        raise ValueError("无效文献编号")
    page = (root / "index.html").read_text(encoding="utf-8")
    page, counts = re.subn(r'(<strong data-paper-count>).*?(</strong>)',
                          lambda m: m[1] + str(len(papers)) + m[2], page, flags=re.S)
    if counts != 2:
        raise ValueError("文献数量生成区域应有两处")
    ordered = sorted(papers, key=lambda p: (p.get("publication_date") or f"{p['year']}-01-01", p["id"]), reverse=True)
    page = replace_content(page, "ol", "paper-list", "\n" + "\n".join(card(p) for p in ordered) + "\n")
    options = '<option value="all">全部年份</option>\n' + "\n".join(
        f'<option value="{year}">{year}</option>' for year in sorted({p["year"] for p in papers}, reverse=True)
    )
    page = replace_content(page, "select", "paper-year", "\n" + options + "\n")
    chips = "\n".join(
        f'<button type="button" class="filter-chip" data-filter="{key}" aria-pressed="{str(key == "all").lower()}">{label}<span>{len(papers) if key == "all" else sum(key in p["tags"] for p in papers)}</span></button>'
        for key, label in TOPICS
    )
    page = replace_content(page, "div", "library-filters", "\n" + chips + "\n")
    page = replace_content(page, "p", "paper-result-count", f"显示 {len(papers)} / {len(papers)} 篇文献")
    payload = json.dumps(papers, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c").replace("&", r"\u0026")
    page = replace_content(page, "script", "literature-data", payload)
    checked = library.get("last_checked_at")
    if checked:
        stamp = datetime.fromisoformat(checked).astimezone(ZoneInfo("Asia/Shanghai"))
        scan = f"最近检索：{stamp:%Y-%m-%d %H:%M}（北京时间） · 本次新增 {int(library.get('last_added_count', 0))} 篇"
    else:
        scan = "自动检索尚未运行 · 可先阅读下方精选文献"
    auto_count = sum(p.get("review_status") == "auto" for p in papers)
    panel = f'''<div><span class="field-label">DAILY DISCOVERY / 每日文献追踪</span>
<h3>把新论文，接到你的阅读清单</h3>
<p>{esc(scan)}</p></div>
<p>已收录 {auto_count} 篇自动匹配文献。自动收录条目附 DOI 与书目来源，中文精选导读单独保留。</p>'''
    page = replace_content(page, "aside", "monitor-summary", panel)
    refs = ["# 文献与来源", "", "精选条目含人工中文导读；标记为自动收录的条目仅经元数据与关键词筛选，尚未人工研读。", ""]
    for p in papers:
        refs.extend((f"## {p['id']} · {p['heading']}", "",
                     f"{'; '.join(p['authors'])}. {p['title']}. *{p['journal']}*, {p['year']}. [DOI]({p['url']}) · [Crossref 元数据]({p['source']})",
                     "", p["summary"], "", "阅读提示：" + p["note"], ""))
    return {
        "index.html": page,
        "references.bib": "\n\n".join(bib_entry(p) for p in papers) + "\n",
        "references.ris": "\n\n".join(ris_entry(p) for p in papers) + "\n",
        "REFERENCES.md": "\n".join(refs),
    }


def render(root: Path, library: dict, *, check: bool = False) -> None:
    files = generated_files(root, library)  # Validate every output before writing any file.
    stale = [name for name, text in files.items() if (root / name).read_text(encoding="utf-8") != text]
    if check and stale:
        raise ValueError("生成文件未同步：" + ", ".join(stale))
    if not check:
        for name in stale:
            (root / name).write_text(files[name], encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="同步 HTML、书目与引文导出")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    render(ROOT, json.loads((ROOT / "literature.json").read_text(encoding="utf-8")), check=args.check)
