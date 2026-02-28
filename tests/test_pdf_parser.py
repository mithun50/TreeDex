"""Tests for treedex.pdf_parser module."""

from treedex.pdf_parser import (
    _count_tokens,
    pages_to_tagged_text,
    group_pages,
)


def _make_pages(n=10, tokens_each=100):
    return [
        {"page_num": i, "text": f"Page {i} text.", "token_count": tokens_each}
        for i in range(n)
    ]


class TestCountTokens:
    def test_basic(self):
        count = _count_tokens("hello world")
        assert count > 0
        assert isinstance(count, int)

    def test_empty(self):
        assert _count_tokens("") == 0


class TestPagesToTaggedText:
    def test_single_page(self):
        pages = _make_pages(3)
        result = pages_to_tagged_text(pages, 1, 1)
        assert "<physical_index_1>" in result
        assert "</physical_index_1>" in result
        assert "Page 1 text." in result

    def test_range(self):
        pages = _make_pages(5)
        result = pages_to_tagged_text(pages, 1, 3)
        assert "<physical_index_1>" in result
        assert "<physical_index_2>" in result
        assert "<physical_index_3>" in result
        assert "<physical_index_0>" not in result
        assert "<physical_index_4>" not in result


class TestGroupPages:
    def test_single_group(self):
        pages = _make_pages(5, tokens_each=100)
        groups = group_pages(pages, max_tokens=1000)
        assert len(groups) == 1

    def test_multiple_groups(self):
        pages = _make_pages(10, tokens_each=100)
        groups = group_pages(pages, max_tokens=300, overlap=1)
        assert len(groups) > 1

    def test_overlap(self):
        pages = _make_pages(10, tokens_each=100)
        groups = group_pages(pages, max_tokens=300, overlap=1)
        # Check that groups overlap — last page of group N
        # should appear in group N+1
        for i in range(len(groups) - 1):
            # Find page numbers in each group
            import re
            pages_in_current = set(re.findall(r"physical_index_(\d+)", groups[i]))
            pages_in_next = set(re.findall(r"physical_index_(\d+)", groups[i + 1]))
            overlap = pages_in_current & pages_in_next
            assert len(overlap) >= 1

    def test_no_infinite_loop(self):
        # Single very large page
        pages = [{"page_num": 0, "text": "huge", "token_count": 50000}]
        groups = group_pages(pages, max_tokens=1000)
        assert len(groups) == 1
