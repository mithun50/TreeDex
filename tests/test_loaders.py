"""Tests for treedex.loaders module."""

import os
import tempfile

import pytest

from treedex.loaders import (
    TextLoader,
    HTMLLoader,
    auto_loader,
    _text_to_pages,
)


class TestTextToPages:
    def test_single_page(self):
        pages = _text_to_pages("hello world", chars_per_page=100)
        assert len(pages) == 1
        assert pages[0]["text"] == "hello world"
        assert pages[0]["page_num"] == 0

    def test_multiple_pages(self):
        text = "A" * 9000
        pages = _text_to_pages(text, chars_per_page=3000)
        assert len(pages) == 3
        for i, p in enumerate(pages):
            assert p["page_num"] == i
            assert len(p["text"]) == 3000

    def test_token_count_present(self):
        pages = _text_to_pages("hello world")
        assert "token_count" in pages[0]
        assert pages[0]["token_count"] > 0


class TestTextLoader:
    def test_loads_txt_file(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("This is a test document with some content.")
        loader = TextLoader()
        pages = loader.load(str(f))
        assert len(pages) >= 1
        assert "test document" in pages[0]["text"]

    def test_custom_page_size(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("A" * 100)
        loader = TextLoader(chars_per_page=30)
        pages = loader.load(str(f))
        assert len(pages) == 4  # ceil(100/30) = 4


class TestHTMLLoader:
    def test_strips_tags(self, tmp_path):
        f = tmp_path / "test.html"
        f.write_text("<html><body><p>Hello</p><p>World</p></body></html>")
        loader = HTMLLoader()
        pages = loader.load(str(f))
        text = pages[0]["text"]
        assert "Hello" in text
        assert "World" in text
        assert "<p>" not in text

    def test_strips_script(self, tmp_path):
        f = tmp_path / "test.html"
        f.write_text("<html><script>alert('x')</script><p>Content</p></html>")
        loader = HTMLLoader()
        pages = loader.load(str(f))
        assert "alert" not in pages[0]["text"]
        assert "Content" in pages[0]["text"]


class TestAutoLoader:
    def test_txt_auto(self, tmp_path):
        f = tmp_path / "doc.txt"
        f.write_text("Auto loaded text.")
        pages = auto_loader(str(f))
        assert "Auto loaded text" in pages[0]["text"]

    def test_html_auto(self, tmp_path):
        f = tmp_path / "doc.html"
        f.write_text("<p>Auto HTML</p>")
        pages = auto_loader(str(f))
        assert "Auto HTML" in pages[0]["text"]

    def test_unsupported_extension(self, tmp_path):
        f = tmp_path / "doc.xyz"
        f.write_text("data")
        with pytest.raises(ValueError, match="Unsupported file extension"):
            auto_loader(str(f))

    def test_md_auto(self, tmp_path):
        f = tmp_path / "notes.md"
        f.write_text("# Heading\n\nSome markdown text.")
        pages = auto_loader(str(f))
        assert "markdown" in pages[0]["text"]
