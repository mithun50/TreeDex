import base64
from collections import Counter

import fitz  # pymupdf
import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")

_MIME_MAP = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jpe": "image/jpeg",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
}

_MIN_IMAGE_BYTES = 500
_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


def _count_tokens(text: str) -> int:
    return len(_enc.encode(text))


# ---------------------------------------------------------------------------
# ToC extraction
# ---------------------------------------------------------------------------

def extract_toc(pdf_path: str) -> list[dict] | None:
    """Extract table of contents from PDF bookmarks/outline.

    Returns a list of ``{level, title, physical_index}`` dicts, or *None* if
    the PDF has no usable ToC (fewer than 3 entries).
    """
    with fitz.open(pdf_path) as doc:
        toc = doc.get_toc()
        if not toc or len(toc) < 3:
            return None
        entries = []
        for level, title, page in toc:
            title = title.strip()
            if title:
                entries.append({
                    "level": level,
                    "title": title,
                    "physical_index": max(page - 1, 0),
                })
        return entries if len(entries) >= 3 else None


# ---------------------------------------------------------------------------
# Font-size heading detection
# ---------------------------------------------------------------------------

def _analyze_heading_sizes(doc) -> dict[float, str]:
    """Analyze font sizes across the document and return a mapping of
    ``{font_size: "H1"/"H2"/"H3"}`` for sizes that are larger than body text.

    Samples up to 50 pages for efficiency on large documents.
    """
    size_chars: Counter = Counter()
    sample_limit = min(len(doc), 50)

    for i in range(sample_limit):
        page = doc[i]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if text:
                        size_chars[round(span["size"], 1)] += len(text)

    if not size_chars:
        return {}

    body_size = size_chars.most_common(1)[0][0]

    heading_sizes = sorted(
        [s for s in size_chars if s > body_size + 0.5],
        reverse=True,
    )

    if not heading_sizes:
        return {}

    mapping: dict[float, str] = {}
    for i, size in enumerate(heading_sizes[:3]):
        mapping[size] = f"H{i + 1}"
    return mapping


def _build_annotated_text(page_dict: dict, heading_map: dict[float, str]) -> str:
    """Build page text with ``[H1]``/``[H2]``/``[H3]`` heading markers."""
    lines_out: list[str] = []

    for block in page_dict.get("blocks", []):
        if "lines" not in block:
            continue
        for line in block["lines"]:
            line_text = ""
            line_tag: str | None = None
            for span in line["spans"]:
                text = span["text"]
                size = round(span["size"], 1)
                tag = heading_map.get(size)
                if tag and text.strip():
                    # Pick the highest-priority (lowest number) tag on this line
                    if line_tag is None or tag < line_tag:
                        line_tag = tag
                line_text += text

            stripped = line_text.strip()
            if stripped:
                if line_tag:
                    lines_out.append(f"[{line_tag}] {stripped}")
                else:
                    lines_out.append(stripped)

    return "\n".join(lines_out)


# ---------------------------------------------------------------------------
# Page extraction
# ---------------------------------------------------------------------------

def extract_pages(
    pdf_path: str,
    extract_images: bool = False,
    detect_headings: bool = False,
) -> list[dict]:
    """Extract text from each page of a PDF.

    Returns a list of dicts with page_num, text, token_count, and optionally images.

    When *detect_headings* is True the text of each page will contain
    ``[H1]``/``[H2]``/``[H3]`` markers before heading lines, determined by
    font-size analysis across the document.
    """
    pages = []

    with fitz.open(pdf_path) as doc:
        # Optionally detect heading font sizes
        heading_map: dict[float, str] = {}
        page_dicts: list[dict] | None = None
        if detect_headings:
            heading_map = _analyze_heading_sizes(doc)
            if heading_map:
                page_dicts = [
                    page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
                    for page in doc
                ]

        for i, page in enumerate(doc):
            if heading_map and page_dicts is not None:
                text = _build_annotated_text(page_dicts[i], heading_map)
            else:
                text = page.get_text()

            page_dict = {
                "page_num": i,
                "text": text,
                "token_count": _count_tokens(text),
            }

            if extract_images:
                images = []
                for img_index, img_info in enumerate(page.get_images(full=True)):
                    xref = img_info[0]
                    try:
                        extracted = doc.extract_image(xref)
                        if extracted is None:
                            continue
                        img_bytes = extracted["image"]
                        ext = extracted.get("ext", "png")
                        if len(img_bytes) < _MIN_IMAGE_BYTES:
                            continue
                        if len(img_bytes) > _MAX_IMAGE_BYTES:
                            continue
                        mime_type = _MIME_MAP.get(ext, f"image/{ext}")
                        images.append({
                            "data": base64.b64encode(img_bytes).decode("ascii"),
                            "mime_type": mime_type,
                            "index_on_page": img_index,
                        })
                    except Exception:
                        continue
                if images:
                    page_dict["images"] = images

            pages.append(page_dict)
    return pages


def pages_to_tagged_text(pages: list[dict], start: int, end: int) -> str:
    """Combine pages[start:end+1] into a string with physical index tags.

    Each page is wrapped like:
        <physical_index_0>page text</physical_index_0>
    where the number is the page's page_num.
    """
    parts = []
    for page in pages[start : end + 1]:
        n = page["page_num"]
        parts.append(f"<physical_index_{n}>{page['text']}</physical_index_{n}>")
    return "\n".join(parts)


def group_pages(
    pages: list[dict], max_tokens: int = 20000, overlap: int = 1
) -> list[str]:
    """Split pages into token-budget groups, each returned as tagged text.

    Groups overlap by `overlap` pages for continuity.
    """
    total_tokens = sum(p["token_count"] for p in pages)

    if total_tokens <= max_tokens:
        return [pages_to_tagged_text(pages, 0, len(pages) - 1)]

    groups: list[str] = []
    group_start = 0

    while group_start < len(pages):
        running = 0
        group_end = group_start

        while group_end < len(pages):
            page_tokens = pages[group_end]["token_count"]
            if running + page_tokens > max_tokens and group_end > group_start:
                group_end -= 1
                break
            running += page_tokens
            group_end += 1
        else:
            group_end = len(pages) - 1

        group_end = min(group_end, len(pages) - 1)
        groups.append(pages_to_tagged_text(pages, group_start, group_end))

        if group_end >= len(pages) - 1:
            break

        next_start = group_end + 1 - overlap
        group_start = max(next_start, group_start + 1)

    return groups


def merge_pdfs(pdf_paths: list[str], output_path: str) -> str:
    """Merge multiple PDF files into one. Returns the output path."""
    merged = fitz.open()
    for path in pdf_paths:
        with fitz.open(path) as doc:
            merged.insert_pdf(doc)
    merged.save(output_path)
    merged.close()
    return output_path
