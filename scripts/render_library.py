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
    ("all", "全部主题"), ("auto", "自动收录"),
    ("cathode-basics", "锌电正极基础"),
    ("vanadium", "钒基材料"), ("manganese", "锰基材料"),
    ("prussian-blue", "普鲁士蓝类"),
    ("organic", "有机/钙钛矿"), ("device", "器件与集成"), ("heterojunction", "异质结"),
    ("mechanism", "机理与评价"), ("capacitor", "锌离子电容器"),
    ("aqueous-sodium", "水系钠电"),
)
SYSTEMS = (("all", "全部体系"), ("zinc", "锌基相关文献"),
           ("other-metals", "其他金属离子电池"), ("related-devices", "关联储能器件"))

FACETS = (
    ("scopes", "阅读范围", (("photo", "光辅助 / 光充电"), ("cathode-basics", "锌电正极基础"), ("aqueous-sodium", "水系钠电基础"), ("teacher", "老师分享"), ("group", "课题组成果"), ("related-storage", "关联储能器件"))),
    ("materials", "材料体系", (("vanadium", "钒基"), ("manganese", "锰基"), ("prussian-blue", "普鲁士蓝类"), ("organic", "有机材料"), ("perovskite", "钙钛矿"), ("sulfide", "硫化物"), ("other", "其他材料"))),
    ("directions", "研究方向", (("hydration", "结构水"), ("preintercalation", "离子预嵌入"), ("dissolution", "溶解与稳定性"), ("proton", "质子 / 多载流子"), ("heterojunction", "异质结与界面"), ("defect", "掺杂与缺陷"), ("photothermal", "光热与光电"), ("device", "器件与集成"), ("mechanism", "机理与评价"), ("voltage", "电压与配位场"))),
)


def facet_keys(paper: dict, facet: str) -> list[str]:
    tags = paper.get("tags", [])
    if facet == "scopes":
        allowed = dict(FACETS[0][2])
        base = "cathode-basics" if "cathode-basics" in tags else "aqueous-sodium" if "aqueous-sodium" in tags else "related-storage" if paper.get("battery_category") == "related-devices" else "photo"
        scopes = [key for key in paper["scope_groups"] if key in allowed] if isinstance(paper.get("scope_groups"), list) else [base]
        return list(dict.fromkeys(scopes + (["teacher"] if "teacher" in tags else []) + (["group"] if paper.get("group_collection") is True else [])))
    if facet == "materials":
        if isinstance(paper.get("material_groups"), list):
            return paper["material_groups"]
        found = [key for key in ("vanadium", "manganese", "prussian-blue") if key in tags]
        text = (paper.get("material", "") + " " + paper.get("title", "")).casefold()
        if "perovskite" in text or "钙钛矿" in text:
            found.append("perovskite")
        elif "organic" in tags:
            found.append("organic")
        if re.search(r"sulfide|硫化|mos[₂2]|vs[₂2]|sns[₂2]", text):
            found.append("sulfide")
        return found or ["other"]
    return paper.get("research_topics", [key for key in ("heterojunction", "device", "mechanism") if key in tags])


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def paper_type(paper: dict) -> str:
    if paper.get("article_type") in ("research", "review"):
        return paper["article_type"]
    if paper.get("kind") == "综述":
        return "review"
    if paper.get("kind") in ("研究论文", "关联器件"):
        return "research"
    return "unclassified"


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


def card(p: dict, performance: dict | None = None) -> str:
    authors = "; ".join(p["authors"][:3]) + ("; et al." if len(p["authors"]) > 3 else "")
    journal = " · ".join(str(value) for value in (p["journal"], p.get("publication_date") or p["year"]) if value)
    if p.get("volume") or p.get("pages"):
        journal += " · " + ": ".join(str(p[k]) for k in ("volume", "pages") if p.get(k))
    auto = p.get("review_status") == "auto"
    flag = '<span class="paper-kind automatic">自动收录 · 待研读</span>' if auto else ""
    abstract = f'<p class="paper-abstract" lang="en">{esc(p["abstract"])}</p>' if p.get("abstract") else ""
    related = " related" if p["kind"] == "关联器件" else ""
    category = paper_type(p)
    category_label = {"research": "研究论文", "review": "综述论文", "unclassified": "待分类"}[category]
    if p.get("article_subtype") == "观点文章":
        category_label = "综述 / 观点"
    related_flag = '<span class="paper-kind related">关联器件</span>' if related else ""
    system_flag = ('<span class="paper-kind paper-system">其他金属离子电池</span>'
                   if p.get("battery_category") == "other-metals" else "")
    sodium_flag = ('<span class="paper-kind paper-system">水系钠电</span>'
                   if "aqueous-sodium" in p["tags"] else "")
    foundation_flag = ('<span class="paper-kind paper-system">正极基础</span>'
                       if "cathode-basics" in p["tags"] else "")
    teacher_flag = '<span class="paper-kind paper-system">老师分享</span>' if "teacher" in p["tags"] else ""
    group_flag = '<span class="paper-kind paper-system">课题组成果</span>' if p.get("group_collection") is True else ""
    performance_flag = '<span class="paper-evidence">已录入对比条件</span>' if performance else ""
    topic_labels = dict(FACETS[2][2])
    topic_text = " / ".join(topic_labels[k] for k in p.get("research_topics", []) if k in topic_labels)
    topic_line = f'<p class="paper-topics">研究线索：{esc(topic_text)}</p>' if topic_text else ""
    chinese_title = p.get("title_zh") or ""
    primary_title = chinese_title or p["title"]
    original_title = (f'<p class="paper-title-original" lang="en">{esc(p["title"])}</p>'
                      if chinese_title else '<p class="paper-title-pending">中文标题待补充</p>')
    basis = f'<p>导读依据：{esc(p["reading_basis"])} · 书目核对：{esc(p["verified_on"])}</p>' if p.get("reading_basis") else ""
    publisher = f'<a href="{esc(p["publisher_source"])}" target="_blank" rel="noopener noreferrer">查看摘要与文章来源 ↗</a>' if p.get("publisher_source") else ""
    notices = "".join(f'<p class="paper-notice">{esc(n["label"])} <a href="{esc(n["url"])}" target="_blank" rel="noopener noreferrer">查看出版社更正 ↗</a></p>' for n in p.get("related_notices", []))
    return f'''<li class="paper" id="paper-{esc(p['id'])}" data-id="{esc(p['id'])}">
 <div class="paper-index"><span>{esc(p['id'])}</span><b>{esc(p['year'])}</b></div>
 <div class="paper-body">
  <div class="paper-flags"><span class="paper-kind paper-type-{category}">{category_label}</span>{system_flag}{sodium_flag}{foundation_flag}{teacher_flag}{group_flag}{related_flag}{flag}{performance_flag}<span class="paper-material">{esc(p['material'])}</span></div>
  <h3><a href="{esc(p['url'])}" target="_blank" rel="noopener noreferrer">{esc(primary_title)}</a></h3>
  {original_title}
  <p class="paper-journal">{esc(journal)}</p>
  <p class="paper-authors">{esc(authors)}</p>
  <p class="paper-summary"><strong>中文简介</strong>{esc(p['summary'])}</p>
  {topic_line}
  <details><summary>阅读提示与书目信息</summary>
   <p>阅读切入点：{esc(p['heading'])}</p>
   <p>{esc(p['note'])}</p>{basis}{abstract}{notices}
   <p>完整作者：{esc('; '.join(p['authors']))}</p>
   <a href="{esc(p['source'])}" target="_blank" rel="noopener noreferrer">查看 Crossref 书目记录 ↗</a>
   {publisher}
  </details>
  <span class="paper-doi">DOI: {esc(p['doi'])}</span>
 </div>
 <div class="paper-actions">
  <a class="doi-link" href="{esc(p['url'])}" target="_blank" rel="noopener noreferrer" aria-label="阅读 {esc(p['title'])} 原文">原文入口 <span aria-hidden="true">↗</span></a>
  <button class="copy-citation" type="button" data-copy="{esc(p['id'])}" aria-label="复制 {esc(p['id'])} 引文">复制引文</button>
  <button class="reader-button" type="button" data-favorite="{esc(p['id'])}" aria-label="收藏 {esc(p['id'])}" aria-pressed="false" data-interactive hidden>☆ 收藏</button>
  <button class="reader-button" type="button" data-compare="{esc(p['id'])}" aria-label="对比 {esc(p['id'])}" aria-pressed="false" data-interactive hidden>＋ 加入对比</button>
 </div>
 <div class="paper-reader" data-interactive hidden>
  <label>阅读状态<select data-reading-status="{esc(p['id'])}" aria-label="{esc(p['id'])} 阅读状态"><option value="">未标记</option><option value="todo">待读</option><option value="reading">在读</option><option value="read">已读</option></select></label>
  <details><summary>我的阅读笔记</summary><textarea data-note="{esc(p['id'])}" aria-label="{esc(p['id'])} 阅读笔记" maxlength="2000" placeholder="记下想解决的问题、实验思路或待核对的条件…"></textarea><small>仅保存在当前浏览器；输入时自动保存。</small></details>
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
    home = (root / "index.html").read_text(encoding="utf-8")
    page = (root / "literature.html").read_text(encoding="utf-8")
    page = re.sub(r'(精选文献 · 书目信息已核对 · )\d{4}-\d{2}-\d{2}',
                  lambda m: m[1] + library.get("curated_checked_on", library["updated"]), page)
    def update_count(markup: str, attribute: str, count: int, label: str) -> str:
        pattern = rf'(<strong\b[^>]*\b{attribute}[^>]*>).*?(</strong>)'
        updated, matches = re.subn(pattern, lambda m: m[1] + str(count) + m[2], markup, flags=re.S)
        if matches != 1:
            raise ValueError(f"{label}数量生成区域应有一处")
        return updated

    home = update_count(home, r'data-paper-count(?=[\s>])', len(papers), "首页文献")
    page = update_count(page, r'data-paper-count(?=[\s>])', len(papers), "文献页文献")
    for key, label in SYSTEMS:
        if key != "all":
            total = sum(p.get("battery_category", "zinc") == key for p in papers)
            home = update_count(home, f'data-system-count="{key}"', total, f"首页{label}")
    ordered = sorted(papers, key=lambda p: (p.get("publication_date") or f"{p['year']}-01-01", p["id"]), reverse=True)
    page = replace_content(page, "ol", "paper-list", "\n" + "\n".join(card(p, library.get("comparison_evidence", {}).get(p["id"])) for p in ordered) + "\n")
    options = '<option value="all">全部年份</option>\n' + "\n".join(
        f'<option value="{year}">{year}</option>' for year in sorted({p["year"] for p in papers}, reverse=True)
    )
    page = replace_content(page, "select", "paper-year", "\n" + options + "\n")
    type_labels = (("research", "研究论文"), ("review", "综述类（含观点）"), ("unclassified", "待分类"))
    type_options = f'<option value="all">全部类型 · {len(papers)} 篇</option>' + "".join(
        f'<option value="{key}">{label} · {sum(paper_type(p) == key for p in papers)} 篇</option>'
        for key, label in type_labels if key != "unclassified" or any(paper_type(p) == key for p in papers)
    )
    if 'id="paper-type"' not in page:
        control = ('<label class="type-field"><span class="field-label">文献类型</span>'
                   f'<select class="library-select" id="paper-type">{type_options}</select></label>\n')
        page, inserted = re.subn(r'(?=<label>\s*<span class="field-label">发表年份</span>)',
                                lambda m: control, page)
        if inserted != 1:
            raise ValueError("无法插入文献类型筛选")
    else:
        page = replace_content(page, "select", "paper-type", type_options)
    systems = "\n".join(
        f'<button type="button" class="filter-chip system-chip" data-system="{key}" aria-pressed="{str(key == "all").lower()}">{label}<span>{len(papers) if key == "all" else sum(p.get("battery_category", "zinc") == key for p in papers)}</span></button>'
        for key, label in SYSTEMS
    )
    if 'id="library-systems"' not in page:
        control = ('<div class="library-systems" id="library-systems" role="group" '
                   f'aria-label="按电池体系筛选">\n{systems}\n</div>\n')
        page, inserted = re.subn(r'(?=<form\b[^>]*id="library-search-form")',
                                lambda m: control, page)
        if inserted != 1:
            raise ValueError("无法插入电池体系筛选")
    else:
        page = replace_content(page, "div", "library-systems", "\n" + systems + "\n")
    facet_markup = []
    for facet, label, options in FACETS:
        buttons = "\n".join(
            f'<button type="button" class="filter-chip" data-facet="{facet}" data-value="{key}" aria-pressed="false">{esc(name)}<span>{sum(key in facet_keys(p, facet) for p in papers)}</span></button>'
            for key, name in options
        )
        fieldset = f'<fieldset class="facet-group"><legend>{label}</legend>{buttons}</fieldset>'
        if facet == "directions":
            fieldset = f'<details class="more-directions" id="more-directions"><summary>按研究方向进一步筛选</summary>{fieldset}</details>'
        facet_markup.append(fieldset)
    page = replace_content(page, "div", "library-filters", "\n" + "\n".join(facet_markup) + "\n")
    page = replace_content(page, "p", "paper-result-count", f"显示 {len(papers)} / {len(papers)} 篇文献")
    payload = json.dumps(papers, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c").replace("&", r"\u0026")
    page = replace_content(page, "script", "literature-data", payload)
    comparison = json.dumps(library.get("comparison_evidence", {}), ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c").replace("&", r"\u0026")
    page = replace_content(page, "script", "comparison-data", comparison)
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
        label = {"research": "研究论文", "review": "综述/观点", "unclassified": "待分类"}[paper_type(p)]
        system = dict(SYSTEMS).get(p.get("battery_category", "zinc"), "锌基相关文献")
        refs.extend((f"## {p['id']} · {p.get('title_zh') or p['heading']}", "", f"电池分类：{system} · 文献类型：{label}", "",
                     f"{'; '.join(p['authors'])}. {p['title']}. *{p['journal']}*, {p['year']}. [DOI]({p['url']}) · [Crossref 元数据]({p['source']})",
                     "", p["summary"], "", "阅读提示：" + p["note"], ""))
    page = re.sub(r"(?m)[ \t]+$", "", page)
    outputs = {
        "index.html": home,
        "literature.html": page,
        "references.bib": "\n\n".join(bib_entry(p) for p in papers) + "\n",
        "references.ris": "\n\n".join(ris_entry(p) for p in papers) + "\n",
        "REFERENCES.md": "\n".join(refs),
    }
    if (root / "group.html").is_file():
        group = (root / "group.html").read_text(encoding="utf-8")
        members = [p for p in papers if p.get("group_collection") is True]
        group = update_count(group, "data-group-count(?=[\\s>])", len(members), "课题组")
        for section, selected in (
            ("group-photo", [p for p in members if paper_type(p) == "research" and p.get("battery_category") != "related-devices"]),
            ("group-reviews", [p for p in members if paper_type(p) == "review"]),
            ("group-related", [p for p in members if p.get("battery_category") == "related-devices"]),
        ):
            cards = []
            for p in sorted(selected, key=lambda p: (p.get("publication_date") or str(p["year"]), p["id"]), reverse=True):
                label = "关联器件" if p.get("battery_category") == "related-devices" else "综述" if paper_type(p) == "review" else "研究论文"
                notice = '<p>该论文另有出版社更正，阅读导读时可查看更正入口。</p>' if p.get("related_notices") else ""
                cards.append(f'<a class="topic-paper" href="literature.html?scope=group#paper-{esc(p["id"])}"><small>{esc(p["journal"])} · {esc(p["year"])} · {label} · {esc(p["id"])}</small><strong>{esc(p["title_zh"])}</strong><p lang="en">{esc(p["title"])}</p><p>{esc(p["summary"])}</p>{notice}<span>查看中文导读、DOI 与原文 →</span></a>')
            group = replace_content(group, "div", section, "\n" + "\n".join(cards) + "\n")
        outputs["group.html"] = group
    return outputs


def render(root: Path, library: dict, *, check: bool = False) -> None:
    files = generated_files(root, library)  # Validate every output before writing any file.
    stale = [name for name, text in files.items() if (root / name).read_text(encoding="utf-8") != text]
    if check and stale:
        raise ValueError("生成文件未同步：" + ", ".join(stale))
    if not check:
        for name in stale:
            target = root / name
            original = target.read_bytes()
            # Keep the repository's existing CRLF style in generated exports.
            newline = "\r\n" if original.count(b"\r\n") > original.count(b"\n") / 2 else "\n"
            target.write_bytes(files[name].replace("\n", newline).encode("utf-8"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="同步 HTML、书目与引文导出")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    render(ROOT, json.loads((ROOT / "literature.json").read_text(encoding="utf-8")), check=args.check)
