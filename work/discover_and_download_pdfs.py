#!/usr/bin/env python3
from __future__ import annotations

import csv
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"
OUT_SUMMARY = ROOT / "work" / "pdf_download_summary.tsv"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

PDF_KEYWORDS = [
    "report",
    "outcome",
    "recommend",
    "summary",
    "workshop",
    "verification",
    "methods",
]

HREF_RE = re.compile(r"href\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)
URL_PDF_RE = re.compile(r"\.pdf(?:[?#].*)?$", re.IGNORECASE)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def fetch_url(url: str, timeout: int = 30) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
        data = r.read()
        ctype = (r.headers.get("Content-Type") or "").lower()
        return data, ctype


def is_probably_pdf(data: bytes, ctype: str, url: str) -> bool:
    if data.startswith(b"%PDF"):
        return True
    if "application/pdf" in ctype:
        return True
    if URL_PDF_RE.search(url) and len(data) > 1000:
        return True
    return False


def sanitize_name(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s[:120] or "report"


def extract_candidates(base_url: str, html: str) -> list[str]:
    found: list[str] = []
    for href in HREF_RE.findall(html):
        href = href.replace("\\", "/").strip()
        if href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        abs_url = urllib.parse.urljoin(base_url, href)
        lu = abs_url.lower()
        if (
            ".pdf" in lu
            or "filedownload" in lu
            or ("download" in lu and any(k in lu for k in PDF_KEYWORDS))
        ):
            found.append(abs_url)

    dedup: list[str] = []
    seen = set()
    for u in found:
        if u not in seen:
            seen.add(u)
            dedup.append(u)

    def score(u: str) -> tuple[int, int]:
        lu = u.lower()
        key_score = sum(1 for k in PDF_KEYWORDS if k in lu)
        path_score = 1 if URL_PDF_RE.search(lu) else 0
        return (key_score, path_score)

    dedup.sort(key=score, reverse=True)
    return dedup


def extract_all_links(base_url: str, html: str) -> list[str]:
    links: list[str] = []
    for href in HREF_RE.findall(html):
        href = href.replace("\\", "/").strip()
        if href.startswith(("javascript:", "mailto:", "#")):
            continue
        links.append(urllib.parse.urljoin(base_url, href))
    dedup: list[str] = []
    seen = set()
    for u in links:
        if u not in seen:
            seen.add(u)
            dedup.append(u)
    return dedup


def process_dir(report_dir: Path) -> tuple[str, str, int, int]:
    topic = report_dir.name
    src_url_file = report_dir / "source_url.txt"
    if not src_url_file.exists():
        return topic, "missing_source_url", 0, 0

    source_url = src_url_file.read_text(encoding="utf-8", errors="ignore").strip()
    source_page_file = report_dir / "source_page.html"

    html = ""
    if source_page_file.exists() and source_page_file.stat().st_size > 0:
        html = read_text(source_page_file)
    else:
        try:
            raw, ctype = fetch_url(source_url)
            if is_probably_pdf(raw, ctype, source_url):
                pdf_dir = report_dir / "pdfs"
                pdf_dir.mkdir(exist_ok=True)
                out = pdf_dir / "source_direct.pdf"
                out.write_bytes(raw)
                return topic, "direct_pdf", 1, 1
            html = raw.decode("utf-8", errors="ignore")
            if html:
                source_page_file.write_text(html, encoding="utf-8")
        except Exception as e:  # noqa: BLE001
            (report_dir / "pdf_discovery_error.txt").write_text(str(e), encoding="utf-8")
            return topic, "fetch_failed", 0, 0

    candidates = extract_candidates(source_url, html)

    # One-step crawl for pages that don't expose direct PDF links.
    if not candidates:
        try:
            base_host = urllib.parse.urlparse(source_url).netloc
            internal = []
            for u in extract_all_links(source_url, html):
                pu = urllib.parse.urlparse(u)
                if pu.scheme in ("http", "https") and pu.netloc == base_host:
                    internal.append(u)
            internal = internal[:20]
            for page_url in internal:
                try:
                    data, ctype = fetch_url(page_url, timeout=20)
                    if "text/html" not in ctype and not data.startswith(b"<!DOCTYPE"):
                        continue
                    sub_html = data.decode("utf-8", errors="ignore")
                    candidates.extend(extract_candidates(page_url, sub_html))
                except Exception:
                    continue
        except Exception:
            pass

        # de-duplicate after depth-1 crawl
        seen = set()
        dedup_cands: list[str] = []
        for u in candidates:
            if u not in seen:
                seen.add(u)
                dedup_cands.append(u)
        candidates = dedup_cands
    (report_dir / "pdf_candidates.txt").write_text("\n".join(candidates) + ("\n" if candidates else ""), encoding="utf-8")

    if not candidates:
        return topic, "no_pdf_links_found", 0, 0

    pdf_dir = report_dir / "pdfs"
    pdf_dir.mkdir(exist_ok=True)

    success = 0
    attempted = 0
    per_file_rows: list[str] = []

    # limit attempts for speed and to avoid excessive requests
    for idx, u in enumerate(candidates[:12], start=1):
        attempted += 1
        try:
            data, ctype = fetch_url(u)
            if not is_probably_pdf(data, ctype, u):
                per_file_rows.append(f"{u}\tnot_pdf\t{len(data)}\t{ctype}")
                continue

            parsed = urllib.parse.urlparse(u)
            leaf = os.path.basename(parsed.path) or f"report_{idx}.pdf"
            if not leaf.lower().endswith(".pdf"):
                leaf = f"{leaf}.pdf"
            leaf = sanitize_name(leaf)
            if not leaf.endswith(".pdf"):
                leaf += ".pdf"

            out = pdf_dir / f"{idx:02d}_{leaf}"
            out.write_bytes(data)
            per_file_rows.append(f"{u}\tok\t{len(data)}\t{ctype}")
            success += 1

            # Keep this manageable: we only need a few readable PDFs per topic.
            if success >= 3:
                break
        except Exception as e:  # noqa: BLE001
            per_file_rows.append(f"{u}\terror\t0\t{str(e).replace(chr(9),' ')}")

    (report_dir / "pdf_download_log.tsv").write_text("\n".join(per_file_rows) + ("\n" if per_file_rows else ""), encoding="utf-8")

    if success > 0:
        return topic, "ok", attempted, success
    return topic, "no_downloadable_pdfs", attempted, 0


def main() -> int:
    rows = []
    for report_dir in sorted(REPORTS_DIR.iterdir()):
        if report_dir.is_dir():
            rows.append(process_dir(report_dir))

    with OUT_SUMMARY.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["topic", "status", "attempted", "downloaded"])
        for row in rows:
            w.writerow(row)

    for topic, status, attempted, downloaded in rows:
        print(f"{topic}\t{status}\t{attempted}\t{downloaded}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
