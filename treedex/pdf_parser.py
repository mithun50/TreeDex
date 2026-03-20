import base64

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


def extract_pages(pdf_path: str, extract_images: bool = False) -> list[dict]:
    """Extract text from each page of a PDF.

    Returns a list of dicts with page_num, text, token_count, and optionally images.
    """
    pages = []
    with fitz.open(pdf_path) as doc:
        for i, page in enumerate(doc):
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
