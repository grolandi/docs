#!/usr/bin/env python3
"""
inBiot docs → branded PDF generator.

Reads pdf-generator/pdfs.config.json, composes each document from one or
more MDX pages of the Mintlify repo, and renders a branded PDF (cover,
logo, TOC, page numbers) into the configured output directory.

Usage:  python3 pdf-generator/generate.py [--only <doc-id>]
Run from the repo root (the GitHub Action does this automatically).
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

import markdown
import yaml
from weasyprint import HTML

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(__file__).resolve().parent / "pdfs.config.json"


# ---------------------------------------------------------------- MDX handling

def parse_frontmatter(text: str):
    """Return (frontmatter_dict, body)."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.DOTALL)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    return fm, text[m.end():]


def mdx_to_markdown(body: str) -> str:
    """Convert the MDX components used in this repo to plain Markdown/HTML."""
    # Remove import/export statements
    body = re.sub(r"^(import|export)\s.+$", "", body, flags=re.MULTILINE)

    # Callouts -> styled divs
    for tag, label in [("Note", "Note"), ("Tip", "Tip"),
                       ("Warning", "Warning"), ("Info", "Info"),
                       ("Check", "Check")]:
        body = re.sub(rf"<{tag}>", f'<div class="callout callout-{tag.lower()}"><strong>{label}:</strong> ', body)
        body = re.sub(rf"</{tag}>", "</div>", body)

    # Frame -> keep inner content (usually an image)
    body = re.sub(r"<Frame[^>]*>", "", body)
    body = body.replace("</Frame>", "")

    # Tabs -> sequential sections titled by tab name
    body = re.sub(r'<Tab\s+title="([^"]+)"[^>]*>', r"\n\n**\1**\n\n", body)
    for tag in ["Tabs", "Tab", "Columns", "CardGroup", "Expandable",
                "AccordionGroup", "Accordion", "Steps"]:
        body = re.sub(rf"</?{tag}[^>]*>", "", body)

    # Step -> numbered-ish heading
    body = re.sub(r'<Step\s+title="([^"]+)"[^>]*>', r"\n\n**\1**\n\n", body)
    body = body.replace("</Step>", "")

    # Card -> title + content
    body = re.sub(r'<Card\s+title="([^"]+)"[^>]*>', r"\n\n**\1**\n\n", body)
    body = re.sub(r'<Card\s+title="([^"]+)"[^>]*/>', r"\n\n**\1**\n\n", body)
    body = body.replace("</Card>", "")

    # Param/Response fields -> definition-style lines
    body = re.sub(r'<(?:Param|Response)Field\s+(?:path|name)="([^"]+)"(?:\s+type="([^"]+)")?[^>]*>',
                  lambda m: f"\n\n**`{m.group(1)}`**" + (f" *({m.group(2)})*" if m.group(2) else "") + " — ",
                  body)
    body = re.sub(r"</(?:Param|Response)Field>", "", body)

    # Icons and any leftover self-closing components -> drop
    body = re.sub(r"<Icon[^>]*/?>", "", body)
    body = re.sub(r"<[A-Z][a-zA-Z]*[^>]*/>", "", body)
    # Any unknown remaining component tags -> strip tags, keep content
    body = re.sub(r"</?[A-Z][a-zA-Z]*[^>]*>", "", body)

    return body


def demote_headings(md_text: str) -> str:
    """H1->H2, H2->H3 ... so the document title stays the only H1."""
    return re.sub(r"^(#{1,5})\s", lambda m: "#" * (len(m.group(1)) + 1) + " ", md_text, flags=re.MULTILINE)


def extract_section(md_text: str, anchor: str) -> str:
    """Return only the content under the heading matching `anchor` (slug)."""
    def slug(s):
        return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    lines = md_text.splitlines()
    out, capturing, level = [], False, 0
    for line in lines:
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            if capturing and len(m.group(1)) <= level:
                break
            if not capturing and slug(m.group(2)) == anchor:
                capturing, level = True, len(m.group(1))
        if capturing:
            out.append(line)
    return "\n".join(out) if out else md_text


def fix_image_paths(html: str) -> str:
    """Make absolute /images/... paths resolve against the repo root."""
    return re.sub(r'src="/(?!/)', f'src="{REPO_ROOT.as_uri()}/', html)


# ---------------------------------------------------------------- rendering

MD = markdown.Markdown(extensions=["tables", "fenced_code", "attr_list", "toc"])


def build_document_html(doc: dict, branding: dict) -> str:
    sections = []
    for page_ref in doc["pages"]:
        anchor = None
        if "#" in page_ref:
            page_ref, anchor = page_ref.split("#", 1)
        path = REPO_ROOT / page_ref
        if not path.exists():
            print(f"  ! missing page, skipped: {page_ref}", file=sys.stderr)
            continue
        fm, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        md_text = mdx_to_markdown(body)
        if anchor:
            md_text = extract_section(md_text, anchor)
        md_text = demote_headings(md_text)
        title = fm.get("title", path.stem.replace("-", " ").title())
        MD.reset()
        html = MD.convert(md_text)
        sections.append(f'<section class="doc-section"><h2 class="section-title">{title}</h2>{html}</section>')

    toc_html = ""
    if doc.get("toc"):
        items = "".join(
            f"<li>{re.search(r'<h2 class=.section-title.>(.*?)</h2>', s).group(1)}</li>"
            for s in sections if "section-title" in s
        )
        toc_html = f'<section class="toc-page"><h2>Contents</h2><ol>{items}</ol></section>'

    logo_path = (REPO_ROOT / branding["logo"]).as_uri()
    logo_white = (REPO_ROOT / branding.get("logo_white", branding["logo"])).as_uri()
    accent = branding.get("accent_color", "#009BE5")
    font = branding.get("font_family", "Roboto")
    copyright_ = branding.get("copyright", f"Copyright © {branding['company']}")
    version = doc.get("version", "")
    doc_type = doc.get("doc_type", "DATASHEET")

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page {{
  size: A4; margin: 2.2cm 1.8cm 2.4cm 1.8cm;
  @bottom-left  {{ content: "{copyright_}"; font-size: 8.5pt; color: #b0b8bf; font-family: {font}; }}
  @bottom-right {{ content: counter(page); font-size: 8.5pt; color: #b0b8bf; font-family: {font}; }}
}}
@page cover {{ margin: 0; background: {accent};
  @bottom-left {{ content: none }} @bottom-right {{ content: none }} }}
@page back {{ margin: 0; background: {accent};
  @bottom-left {{ content: none }} @bottom-right {{ content: none }} }}
body {{ font-family: {font}, Arial, sans-serif; font-size: 10.5pt; color: #3c4858; line-height: 1.5; }}

/* ---- cover ---- */
.cover {{ page: cover; height: 29.7cm; position: relative; box-sizing: border-box;
  padding: 2.2cm 2cm; color: #fff; page-break-after: always; }}
.cover .watermark {{ position: absolute; bottom: -4cm; left: -4cm; width: 18cm; opacity: .14; }}
.cover .head {{ display: flex; justify-content: space-between; align-items: flex-start; }}
.cover h1 {{ font-size: 44pt; font-weight: 700; margin: 0; letter-spacing: .02em;
  border-bottom: 4px solid #fff; padding-bottom: .5cm; flex: 1; margin-right: 1cm; }}
.cover img.mark {{ width: 2.2cm; margin-top: .3cm; }}
.cover .foot {{ position: absolute; bottom: 2.2cm; left: 2cm; right: 2cm;
  border-bottom: 3px solid #fff; padding-bottom: .35cm;
  display: flex; justify-content: space-between; font-size: 16pt; }}
.cover .subtitle {{ margin-top: .8cm; font-size: 14pt; opacity: .95; }}

/* ---- table of contents ---- */
.toc-page {{ page-break-after: always; }}
.toc-page h2 {{ color: {accent}; font-size: 17pt; }}
.toc-page ol {{ font-size: 11.5pt; line-height: 2.1; color: #3c4858; }}

/* ---- sections ---- */
.doc-section {{ page-break-before: always; }}
h2.section-title {{ background: {accent}; color: #fff; font-size: 16pt; font-weight: 500;
  border-radius: 24px; padding: .3cm .7cm; margin: 0 0 .5cm 0; }}
h3 {{ font-size: 13pt; color: {accent}; font-weight: 500; }}
h4 {{ font-size: 11.5pt; color: #3c4858; }}
table {{ border-collapse: collapse; width: 100%; margin: .4cm 0; font-size: 9.5pt; }}
th, td {{ border: 1px solid #e2e8ee; padding: .14cm .28cm; text-align: left; }}
th {{ background: {accent}; color: #fff; font-weight: 500; }}
tr:nth-child(even) td {{ background: #f2f9fe; }}
img {{ max-width: 100%; }}
code {{ background: #f1f6fa; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }}
pre {{ background: #f1f6fa; padding: .3cm; border-radius: 6px; font-size: 8.5pt; overflow: hidden; }}
a {{ color: {accent}; text-decoration: none; }}
ol > li::marker, ul > li::marker {{ color: {accent}; }}
.callout {{ border-left: 4px solid {accent}; background: #eef8fe; padding: .25cm .4cm;
  margin: .3cm 0; border-radius: 0 6px 6px 0; }}
.callout-warning {{ border-left-color: #e67e22; background: #fdf6ee; }}
hr {{ border: none; border-top: 1px solid #e2e8ee; margin: .35cm 0; }}

/* ---- back cover ---- */
.back {{ page: back; page-break-before: always; height: 29.7cm; position: relative;
  box-sizing: border-box; padding: 2.2cm 2cm; }}
.back img.mark {{ width: 2.2cm; }}
.back .site {{ position: absolute; bottom: 2.2cm; right: 2cm; text-align: right;
  color: #fff; font-size: 12pt; line-height: 1.7; }}
</style></head><body>

<div class="cover">
  <img class="watermark" src="{logo_white}">
  <div class="head">
    <h1>{doc["title"].upper()}</h1>
    <img class="mark" src="{logo_white}">
  </div>
  <div class="subtitle">{doc.get("subtitle", "")}</div>
  <div class="foot"><span>{version}</span><span>{doc_type}</span></div>
</div>
{toc_html}
{"".join(fix_image_paths(s) for s in sections)}
<div class="back">
  <img class="mark" src="{logo_white}">
  <div class="site">www.inbiot.es<br>{copyright_}</div>
</div>
</body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="generate a single document by id")
    args = ap.parse_args()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    out_dir = REPO_ROOT / config.get("output_dir", "files")
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in config["documents"]:
        if args.only and doc["id"] != args.only:
            continue
        print(f"• {doc['id']}")
        html = build_document_html(doc, config["branding"])
        out = out_dir / f"{doc['id']}.pdf"
        HTML(string=html, base_url=str(REPO_ROOT)).write_pdf(str(out))
        print(f"  → {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
