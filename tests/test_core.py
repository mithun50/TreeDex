"""Tests for treedex.core module."""

import json
import os
import tempfile

import pytest

from treedex.core import TreeDex, QueryResult
from treedex.llm_backends import FunctionLLM
from treedex.tree_builder import list_to_tree, assign_page_ranges, assign_node_ids, embed_text_in_tree


def _make_mock_llm():
    """Create a mock LLM that returns valid structure/retrieval JSON."""

    def mock_generate(prompt: str) -> str:
        if "structure analyzer" in prompt or "continuing to extract" in prompt:
            return json.dumps([
                {"structure": "1", "title": "Introduction", "physical_index": 0},
                {"structure": "1.1", "title": "Background", "physical_index": 0},
                {"structure": "2", "title": "Methods", "physical_index": 1},
            ])
        elif "retrieval system" in prompt:
            return json.dumps({
                "node_ids": ["0001", "0003"],
                "reasoning": "These sections are most relevant.",
            })
        return "{}"

    return FunctionLLM(mock_generate)


def _make_pages(n=5):
    return [
        {"page_num": i, "text": f"Content of page {i}.", "token_count": 50}
        for i in range(n)
    ]


def _make_tree_and_pages():
    data = [
        {"structure": "1", "title": "Intro", "physical_index": 0},
        {"structure": "1.1", "title": "Background", "physical_index": 0},
        {"structure": "2", "title": "Methods", "physical_index": 2},
    ]
    pages = _make_pages(5)
    tree = list_to_tree(data)
    assign_page_ranges(tree, total_pages=5)
    assign_node_ids(tree)
    embed_text_in_tree(tree, pages)
    return tree, pages


class TestQueryResult:
    def test_pages_str_single(self):
        qr = QueryResult("ctx", ["0001"], [(0, 0)], "reason")
        assert qr.pages_str == "pages 1"

    def test_pages_str_range(self):
        qr = QueryResult("ctx", ["0001"], [(4, 7)], "reason")
        assert qr.pages_str == "pages 5-8"

    def test_pages_str_multiple(self):
        qr = QueryResult("ctx", ["0001", "0002"], [(0, 2), (5, 5)], "reason")
        assert qr.pages_str == "pages 1-3, 6"

    def test_pages_str_empty(self):
        qr = QueryResult("ctx", [], [], "reason")
        assert qr.pages_str == "no pages"

    def test_repr(self):
        qr = QueryResult("context text", ["0001"], [(0, 2)], "reason")
        r = repr(qr)
        assert "0001" in r
        assert "context_len=" in r


class TestTreeDexFromTree:
    def test_basic_construction(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        assert index.tree is tree
        assert index.pages is pages

    def test_stats(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        stats = index.stats()
        assert stats["total_pages"] == 5
        assert stats["total_nodes"] == 3
        assert stats["root_sections"] == 2

    def test_show_tree(self, capsys):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        index.show_tree()
        out = capsys.readouterr().out
        assert "Intro" in out
        assert "Methods" in out


class TestTreeDexFromPages:
    def test_from_pages(self):
        llm = _make_mock_llm()
        pages = _make_pages(5)
        index = TreeDex.from_pages(pages, llm, verbose=False)
        assert index.stats()["total_nodes"] == 3

    def test_from_file_txt(self, tmp_path):
        llm = _make_mock_llm()
        f = tmp_path / "test.txt"
        f.write_text("Hello world. " * 100)
        index = TreeDex.from_file(str(f), llm, verbose=False)
        assert index.stats()["total_pages"] >= 1


class TestTreeDexQuery:
    def test_query(self):
        tree, pages = _make_tree_and_pages()
        llm = _make_mock_llm()
        index = TreeDex.from_tree(tree, pages, llm)
        result = index.query("What methods were used?")

        assert "0001" in result.node_ids
        assert "0003" in result.node_ids
        assert len(result.context) > 0
        assert "relevant" in result.reasoning

    def test_query_with_override_llm(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)

        llm = _make_mock_llm()
        result = index.query("question", llm=llm)
        assert len(result.node_ids) > 0

    def test_query_no_llm_raises(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        with pytest.raises(ValueError, match="No LLM provided"):
            index.query("question")


class TestTreeDexSaveLoad:
    def test_save_load_roundtrip(self, tmp_path):
        tree, pages = _make_tree_and_pages()
        llm = _make_mock_llm()
        index = TreeDex.from_tree(tree, pages, llm)

        path = str(tmp_path / "index.json")
        index.save(path)

        assert os.path.exists(path)

        loaded = TreeDex.load(path, llm=llm)
        assert loaded.stats()["total_nodes"] == index.stats()["total_nodes"]
        assert loaded.stats()["total_pages"] == index.stats()["total_pages"]

    def test_load_and_query(self, tmp_path):
        tree, pages = _make_tree_and_pages()
        llm = _make_mock_llm()
        index = TreeDex.from_tree(tree, pages, llm)

        path = str(tmp_path / "index.json")
        index.save(path)

        loaded = TreeDex.load(path, llm=llm)
        result = loaded.query("test question")
        assert len(result.node_ids) > 0


class TestFindLargeSections:
    def test_finds_large(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        large = index.find_large_sections(max_pages=1)
        assert len(large) > 0

    def test_none_large(self):
        tree, pages = _make_tree_and_pages()
        index = TreeDex.from_tree(tree, pages)
        large = index.find_large_sections(max_pages=100)
        assert len(large) == 0
