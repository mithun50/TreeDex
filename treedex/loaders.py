"""Document loaders for multiple file formats.

Each loader returns a list of dicts: [{"page_num": int, "text": str, "token_count": int}]
matching the format used by pdf_parser.extract_pages().
"""

import os
import re
from html.parser import HTMLParser

import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_enc.encode(text))


def _text_to_pages(text: str, chars_per_page: int = 3000) -> list[dict]:
    """Split plain text into synthetic pages by character count."""
    pages = []
    for i in range(0, len(text), chars_per_page):
        chunk = text[i : i + chars_per_page]
        pages.append({
            "page_num": len(pages),
            "text": chunk,
            "token_count": _count_tokens(chunk),
        })
    return pages


class PDFLoader:
    """Load PDF files using PyMuPDF."""

    def __init__(self, extract_images: bool = False, detect_headings: bool = False):
        self.extract_images = extract_images
        self.detect_headings = detect_headings

    def load(self, path: str) -> list[dict]:
        from treedex.pdf_parser import extract_pages
        return extract_pages(
            path,
            extract_images=self.extract_images,
            detect_headings=self.detect_headings,
        )


class TextLoader:
    """Load plain text or markdown files."""

    def __init__(self, chars_per_page: int = 3000):
        self.chars_per_page = chars_per_page

    def load(self, path: str) -> list[dict]:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        return _text_to_pages(text, self.chars_per_page)


class _HTMLStripper(HTMLParser):
    """Simple HTML-to-text converter using stdlib."""

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True
        if tag == "img":
            attrs_dict = dict(attrs)
            alt = attrs_dict.get("alt", "").strip()
            if alt:
                self._parts.append(f"\n[Image: {alt}]\n")
            else:
                self._parts.append("\n[Image]\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False
        if tag in ("p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"):
            self._parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = "".join(self._parts)
        return re.sub(r"\n{3,}", "\n\n", raw).strip()


class HTMLLoader:
    """Load HTML files, stripping tags to plain text (stdlib only)."""

    def __init__(self, chars_per_page: int = 3000):
        self.chars_per_page = chars_per_page

    def load(self, path: str) -> list[dict]:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        stripper = _HTMLStripper()
        stripper.feed(html)
        text = stripper.get_text()
        return _text_to_pages(text, self.chars_per_page)


class DOCXLoader:
    """Load DOCX files using python-docx."""

    def __init__(self, chars_per_page: int = 3000):
        self.chars_per_page = chars_per_page

    def load(self, path: str) -> list[dict]:
        import docx
        from docx.oxml.ns import qn

        doc = docx.Document(path)
        parts = []
        for paragraph in doc.paragraphs:
            parts.append(paragraph.text)
            # Check for inline images in the paragraph's XML
            for drawing in paragraph._element.findall(f".//{qn('wp:inline')}"):
                doc_pr = drawing.find(qn("wp:docPr"))
                if doc_pr is not None:
                    alt = doc_pr.get("descr", "").strip()
                    if alt:
                        parts.append(f"[Image: {alt}]")
                    else:
                        parts.append("[Image]")
        text = "\n".join(parts)
        return _text_to_pages(text, self.chars_per_page)


_EXTENSION_MAP = {
    ".pdf": PDFLoader,
    ".txt": TextLoader,
    ".md": TextLoader,
    ".html": HTMLLoader,
    ".htm": HTMLLoader,
    ".docx": DOCXLoader,
}


def auto_loader(
    path: str,
    extract_images: bool = False,
    detect_headings: bool = False,
) -> list[dict]:
    """Auto-detect file format and load pages."""
    ext = os.path.splitext(path)[1].lower()
    loader_cls = _EXTENSION_MAP.get(ext)
    if loader_cls is None:
        raise ValueError(
            f"Unsupported file extension '{ext}'. "
            f"Supported: {', '.join(_EXTENSION_MAP)}"
        )
    if ext == ".pdf":
        return PDFLoader(
            extract_images=extract_images,
            detect_headings=detect_headings,
        ).load(path)
    return loader_cls().load(path)
