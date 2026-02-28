"""Tests for treedex.tree_utils module."""

import pytest

from treedex.tree_builder import list_to_tree, assign_page_ranges, assign_node_ids, embed_text_in_tree
from treedex.tree_utils import (
    create_node_mapping,
    strip_text_from_tree,
    collect_node_texts,
    count_nodes,
    get_leaf_nodes,
    tree_to_flat_list,
    extract_json,
    print_tree,
)


def _make_tree():
    data = [
        {"structure": "1", "title": "Chapter 1", "physical_index": 0},
        {"structure": "1.1", "title": "Section 1.1", "physical_index": 0},
        {"structure": "1.2", "title": "Section 1.2", "physical_index": 5},
        {"structure": "2", "title": "Chapter 2", "physical_index": 10},
        {"structure": "2.1", "title": "Section 2.1", "physical_index": 10},
    ]
    tree = list_to_tree(data)
    assign_page_ranges(tree, total_pages=20)
    assign_node_ids(tree)
    pages = [
        {"page_num": i, "text": f"Content of page {i}.", "token_count": 10}
        for i in range(20)
    ]
    embed_text_in_tree(tree, pages)
    return tree, pages


class TestCreateNodeMapping:
    def test_all_nodes_mapped(self):
        tree, _ = _make_tree()
        mapping = create_node_mapping(tree)
        assert len(mapping) == 5

    def test_lookup_by_id(self):
        tree, _ = _make_tree()
        mapping = create_node_mapping(tree)
        assert mapping["0001"]["title"] == "Chapter 1"
        assert mapping["0004"]["title"] == "Chapter 2"


class TestStripText:
    def test_text_removed(self):
        tree, _ = _make_tree()
        stripped = strip_text_from_tree(tree)

        def check(nodes):
            for n in nodes:
                assert "text" not in n
                check(n.get("nodes", []))

        check(stripped)

    def test_original_unchanged(self):
        tree, _ = _make_tree()
        strip_text_from_tree(tree)
        assert "text" in tree[0]


class TestCollectNodeTexts:
    def test_collects_text(self):
        tree, _ = _make_tree()
        mapping = create_node_mapping(tree)
        result = collect_node_texts(["0002", "0005"], mapping)
        assert "[1.1: Section 1.1]" in result
        assert "[2.1: Section 2.1]" in result

    def test_missing_node(self):
        tree, _ = _make_tree()
        mapping = create_node_mapping(tree)
        result = collect_node_texts(["9999"], mapping)
        assert result == ""


class TestCountNodes:
    def test_total_count(self):
        tree, _ = _make_tree()
        assert count_nodes(tree) == 5

    def test_empty_tree(self):
        assert count_nodes([]) == 0


class TestGetLeafNodes:
    def test_leaf_count(self):
        tree, _ = _make_tree()
        leaves = get_leaf_nodes(tree)
        assert len(leaves) == 3  # 1.1, 1.2, 2.1

    def test_leaf_titles(self):
        tree, _ = _make_tree()
        leaves = get_leaf_nodes(tree)
        titles = {n["title"] for n in leaves}
        assert titles == {"Section 1.1", "Section 1.2", "Section 2.1"}


class TestTreeToFlatList:
    def test_flat_length(self):
        tree, _ = _make_tree()
        flat = tree_to_flat_list(tree)
        assert len(flat) == 5

    def test_no_nodes_field(self):
        tree, _ = _make_tree()
        flat = tree_to_flat_list(tree)
        for item in flat:
            assert "nodes" not in item

    def test_dfs_order(self):
        tree, _ = _make_tree()
        flat = tree_to_flat_list(tree)
        titles = [n["title"] for n in flat]
        assert titles == [
            "Chapter 1", "Section 1.1", "Section 1.2",
            "Chapter 2", "Section 2.1",
        ]


class TestExtractJson:
    def test_raw_json(self):
        assert extract_json('{"key": "value"}') == {"key": "value"}

    def test_code_block(self):
        text = 'Here is the result:\n```json\n{"a": 1}\n```'
        assert extract_json(text) == {"a": 1}

    def test_trailing_comma(self):
        text = '```json\n{"a": 1, "b": 2,}\n```'
        assert extract_json(text) == {"a": 1, "b": 2}

    def test_embedded_in_text(self):
        text = 'The answer is {"x": [1,2,3]} ok?'
        assert extract_json(text) == {"x": [1, 2, 3]}

    def test_list(self):
        assert extract_json("[1, 2, 3]") == [1, 2, 3]

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Could not extract JSON"):
            extract_json("no json here at all")


class TestPrintTree:
    def test_prints_without_error(self, capsys):
        tree, _ = _make_tree()
        print_tree(tree)
        captured = capsys.readouterr()
        assert "[0001]" in captured.out
        assert "Chapter 1" in captured.out
