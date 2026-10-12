"""Daily Crossref discovery and email digest preparation. Standard library only."""

from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from render_library import ROOT, generated_files


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", str(value)))).strip()


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()


def normalize_doi(value: str) -> str:
    value = re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", value.strip(), flags=re.I).casefold()
    if not re.fullmatch(r"10\.\d{4,9}/[^\s<>]+", value):
        raise ValueError("无效 DOI")
    return value


def relevant(title: str) -> bool:
    text = normalized(title)
    light = re.search(
        r"\b(?:photo ?(?:assisted|rechargeable|charging|charged|enhanced|induced)|"
        r"light (?:assisted|driven|enhanced)|solar (?:rechargeable|charging)|photobatter(?:y|ies))\b", text
    )
    zinc = re.search(r"\b(?:zinc|zn) (?:ion|ions|2)\b", text)
    storage = re.search(r"\b(?:batter(?:y|ies)|storage|photocathodes?)\b", text)
    excluded = re.search(r"\b(?:zinc air|zn air|redox flow|capacitors?|supercapacitors?)\b", text)
    return bool(light and zinc and storage and not excluded)


def publication_date(work: dict) -> tuple[date, int] | None:
    # Prefer the online publication date to a future print/issue date.
    for field in ("published-online", "published", "issued", "published-print"):
        parts = (work.get(field) or {}).get("date-parts", [])
        if not parts or not parts[0]:
            continue
        values = parts[0]
        try:
            return date(int(values[0]), int(values[1]) if len(values) > 1 else 1,
                        int(values[2]) if len(values) > 2 else 1), len(values)
        except (ValueError, TypeError):
            continue
    return None


def crossref_paper(work: dict, today: date, since: date) -> dict | None:
    titles = work.get("title") or []
    if not isinstance(titles, list) or not titles:
        return None
    title = clean_text(titles[0])
    if work.get("type") != "journal-article" or not relevant(title):
        return None
    if work.get("subtype") in ("retraction", "correction", "editorial"):
        return None
    if work.get("relation", {}).get("is-retracted-by"):
        return None
    try:
        doi = normalize_doi(work.get("DOI", ""))
    except ValueError:
        return None
    published = publication_date(work)
    if not published or not since <= published[0] <= today:
        return None
    authors, citation_authors = [], []
    for a in work.get("author") or []:
        name = clean_text(a.get("name") or " ".join(filter(None, (a.get("given"), a.get("family")))))
        if name:
            authors.append(name)
            citation_authors.append(clean_text(", ".join(filter(None, (a.get("family"), a.get("given"))))) if a.get("family") else name)
    tags = ["auto"]
    text = normalized(title)
    for tag, pattern in (("vanadium", r"\b(?:vanadium|v2o5|vo2)\b"),
                         ("heterojunction", r"\b(?:heterojunctions?|heterostructures?)\b"),
                         ("review", r"\b(?:review|perspective|progress)\b"),
                         ("mechanism", r"\b(?:mechanism|kinetics)\b")):
        if re.search(pattern, text):
            tags.append(tag)
    return {
        "title": title, "heading": "新近文献 · 待研读", "tags": tags,
        "kind": "期刊文献", "material": "请查阅原文材料体系",
        "summary": "标题匹配光辅助或光充电锌离子储能主题，书目信息来自 Crossref。自动收录尚未经过人工研读，实验结论请以原文为准。",
        "note": "请核对光照条件、器件类型及暗态对照；自动收录不代表已验证论文结论。",
        "authors": authors, "citationAuthors": citation_authors,
        "journal": clean_text((work.get("container-title") or [""])[0]),
        "year": published[0].year,
        "publication_date": published[0].isoformat()[:{1: 4, 2: 7}.get(published[1], 10)],
        "volume": clean_text(work.get("volume") or ""), "issue": clean_text(work.get("issue") or ""),
        "pages": clean_text(work.get("page") or work.get("article-number") or ""),
        "doi": doi, "url": "https://doi.org/" + urllib.parse.quote(doi, safe="/"),
        "source": "https://api.crossref.org/works/" + urllib.parse.quote(doi, safe=""),
        "abstract": clean_text(work.get("abstract") or "")[:2500],
        "review_status": "auto", "added": today.isoformat(),
    }


def get_crossref(url: str) -> dict:
    contact = os.environ.get("CROSSREF_EMAIL", "").strip()
    agent = "PhotoZincLab/1.0 (https://github.com/terryliu0125-ship-it/photo-zinc-lab"
    agent += f"; mailto:{contact})" if contact else ")"
    request = urllib.request.Request(url, headers={"User-Agent": agent, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if payload.get("status") != "ok" or not isinstance(payload.get("message", {}).get("items"), list):
                raise RuntimeError("Crossref 返回了无效结果，保留现有文献与检索时间")
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise RuntimeError(f"Crossref 请求失败（HTTP {exc.code}）") from None
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == 2:
                raise RuntimeError("Crossref 连接失败，未推进检索时间") from None
        except (json.JSONDecodeError, AttributeError):
            raise RuntimeError("Crossref 返回内容不是有效元数据") from None
        time.sleep(2 ** attempt)
    raise RuntimeError("Crossref 请求失败")


def discover(config: dict, state: dict, now: datetime) -> list[dict]:
    today = now.astimezone(ZoneInfo("Asia/Shanghai")).date()
    since = today - timedelta(days=config["publication_lookback_days"])
    indexed_since = today - timedelta(days=config["index_lookback_days"])
    if state.get("last_checked_at"):
        # Catch up after missed/failed runs, retaining a one-day overlap.
        previous = datetime.fromisoformat(state["last_checked_at"]).date() - timedelta(days=1)
        indexed_since = min(indexed_since, previous)
    excluded = {normalize_doi(doi) for doi in config["exclude_dois"]}
    found = {}
    for position, query in enumerate(config["queries"], 1):
        print(f"检索 {position}/{len(config['queries'])}：{query}", flush=True)
        params = {
            "query.title": query, "rows": str(config["candidates_per_query"]),
            "filter": f"type:journal-article,from-pub-date:{since},until-pub-date:{today},from-index-date:{indexed_since}",
            "sort": "relevance", "order": "desc",
        }
        if os.environ.get("CROSSREF_EMAIL", "").strip():
            params["mailto"] = os.environ["CROSSREF_EMAIL"].strip()
        payload = get_crossref("https://api.crossref.org/works?" + urllib.parse.urlencode(params))
        for work in payload["message"]["items"]:
            paper = crossref_paper(work, today, since)
            if paper and paper["doi"] not in excluded:
                found[paper["doi"]] = paper
    return sorted(found.values(), key=lambda p: (p["publication_date"], p["doi"]), reverse=True)


def merge(library: dict, state: dict, papers: list[dict], now: datetime) -> tuple[dict, dict, list[dict]]:
    library, state = copy.deepcopy(library), copy.deepcopy(state)
    existing = {normalize_doi(p["doi"]) for p in library["papers"]}
    next_id = max((int(p["id"][1:]) for p in library["papers"]), default=0) + 1
    added = []
    for paper in papers:
        if paper["doi"] in existing:
            continue
        paper = {**paper, "id": f"L{next_id:02d}"}
        next_id += 1
        library["papers"].append(paper)
        existing.add(paper["doi"])
        added.append(paper)
    state["pending"] = list(dict.fromkeys(state["pending"] + [p["doi"] for p in added]))
    state["last_checked_at"] = now.isoformat()
    library.setdefault("curated_checked_on", library.get("updated"))
    if added:
        library["updated"] = now.astimezone(ZoneInfo("Asia/Shanghai")).date().isoformat()
    library["last_checked_at"] = now.isoformat()
    library["last_added_count"] = len(added)
    return library, state, added


def load(root: Path) -> tuple[dict, dict, dict]:
    def read(name: str) -> dict:
        return json.loads((root / name).read_text(encoding="utf-8"))
    config, library, state = read("automation/config.json"), read("literature.json"), read("automation/monitor-state.json")
    for key, maximum in (("publication_lookback_days", 730), ("index_lookback_days", 730),
                         ("candidates_per_query", 1000), ("max_notifications", 20)):
        if type(config.get(key)) is not int or not 1 <= config[key] <= maximum:
            raise ValueError(f"无效配置：{key}")
    if not config.get("queries") or not all(isinstance(q, str) and q.strip() for q in config["queries"]):
        raise ValueError("检索词不能为空")
    if state.get("version") != 1 or not isinstance(state.get("pending"), list):
        raise ValueError("推送状态格式无效")
    return config, library, state


def write_json(path: Path, payload: dict) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def refresh(root: Path, now: datetime, *, dry_run: bool = False, site_only: bool = False) -> list[dict]:
    config, library, state = load(root)
    found = discover(config, state, now)  # All searches finish before modifying state.
    library, state, added = merge(library, state, found, now)
    if site_only:
        state["pending"] = []
    print(f"Crossref 匹配 {len(found)} 篇；新增 {len(added)} 篇；待推送 {len(state['pending'])} 篇。")
    for p in added:
        print(f"{p['publication_date']} · {p['title']} · {p['doi']}")
    if not dry_run:
        files = generated_files(root, library)
        for name, content in files.items():
            (root / name).write_text(content, encoding="utf-8")
        write_json(root / "literature.json", library)
        write_json(root / "automation/monitor-state.json", state)
    return added


def email_digest(root: Path, now: datetime) -> dict | None:
    config, library, state = load(root)
    if state.get("last_checked_at") != library.get("last_checked_at") or not state.get("last_checked_at"):
        raise ValueError("请先成功运行 refresh，再发送日报")
    today = now.astimezone(ZoneInfo("Asia/Shanghai")).date().isoformat()
    checked_date = datetime.fromisoformat(state["last_checked_at"]).astimezone(ZoneInfo("Asia/Shanghai")).date().isoformat()
    if checked_date != today:
        raise ValueError("今天尚未成功检索，停止发送过期日报")
    if state.get("last_digest_date") == today:
        return None
    index = {normalize_doi(p["doi"]): p for p in library["papers"]}
    excluded = {normalize_doi(doi) for doi in config["exclude_dois"]}
    pending = list(dict.fromkeys(normalize_doi(doi) for doi in state["pending"]
                                if normalize_doi(doi) in index and normalize_doi(doi) not in excluded))
    selected = pending[:config["max_notifications"]]
    if not selected and not config["notify_empty"]:
        return None
    subject = f"光锌文献日报｜{today}｜{len(selected)}篇新文献"
    lines = ["<div style='font-family:Arial,sans-serif;line-height:1.65;color:#16362d;max-width:680px'>",
             f"<h2>光锌文献日报 · {today}</h2>",
             "<p>主题：光辅助与光充电锌离子电池。以下条目来自 Crossref 自动检索，请以原文核对实验结论。</p>"]
    for doi in selected:
        p = index[doi]
        authors = ", ".join(p["authors"][:3]) + (" 等" if len(p["authors"]) > 3 else "")
        lines.append("<section style='border-top:1px solid #d4e4dc;padding:14px 0'>"
                     f"<a href='{html.escape(p['url'], quote=True)}' style='font-weight:bold'>{html.escape(p['title'])}</a><br>"
                     f"{html.escape(p['journal'])} · {html.escape(str(p.get('publication_date') or p['year']))}<br>"
                     f"{html.escape(authors)}<br>DOI: {html.escape(doi)}</section>")
    if not selected:
        lines.append("<p>今天在本次检索范围内未发现尚未发送的新文献。</p>")
    if len(pending) > len(selected):
        lines.append(f"<p>还有 {len(pending) - len(selected)} 篇待发送，将在后续日报中继续发送。</p>")
    lines.append("<p style='color:#60766c;font-size:13px'>来源：Crossref；自动收录待研读。邮件由已连接的 Gmail 账号发送。</p></div>")
    digest_id = hashlib.sha256(json.dumps([today, selected], ensure_ascii=False).encode()).hexdigest()
    return {"subject": subject, "html": "".join(lines), "digest_id": digest_id,
            "dois": selected, "date": today}


def acknowledge_email(root: Path, now: datetime, digest_id: str) -> bool:
    digest = email_digest(root, now)
    if digest is None:
        return False
    if digest["digest_id"] != digest_id:
        raise ValueError("日报内容已变化，不能确认旧邮件")
    config, _, state = load(root)
    selected = set(digest["dois"])
    excluded = {normalize_doi(doi) for doi in config["exclude_dois"]}
    state["pending"] = [doi for doi in state["pending"] if normalize_doi(doi) not in selected | excluded]
    state["last_digest_id"] = digest_id
    state["last_digest_date"] = digest["date"]
    state["last_delivery_at"] = now.isoformat()
    write_json(root / "automation/monitor-state.json", state)
    print(f"已记录 Gmail 发信确认，包含 {len(selected)} 篇文献。")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="每日更新光辅助锌离子电池文献，准备邮件日报")
    parser.add_argument("command", choices=("refresh", "email", "ack-email"))
    parser.add_argument("--dry-run", action="store_true", help="仅检索并打印，不修改网站或发送消息")
    parser.add_argument("--site-only", action="store_true", help="仅更新公开网站，不保留本地邮件队列")
    parser.add_argument("--digest-id", help="Gmail 确认发信后用于确认本次日报")
    args = parser.parse_args()
    if (args.dry_run or args.site_only) and args.command != "refresh":
        parser.error("--dry-run 和 --site-only 仅用于 refresh")
    if args.command == "ack-email" and not args.digest_id:
        parser.error("ack-email 需要 --digest-id")
    now = datetime.now(timezone.utc)
    if args.command == "refresh":
        refresh(ROOT, now, dry_run=args.dry_run, site_only=args.site_only)
    elif args.command == "email":
        print(json.dumps(email_digest(ROOT, now), ensure_ascii=False))
    else:
        acknowledge_email(ROOT, now, args.digest_id)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, KeyError, json.JSONDecodeError) as exc:
        print(f"错误：{exc}", file=sys.stderr)
        raise SystemExit(1)
