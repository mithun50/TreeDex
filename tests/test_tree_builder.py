"""Tests for treedex.tree_builder module."""

from treedex.tree_builder import (
    list_to_tree,
    assign_page_ranges,
    assign_node_ids,
    find_large_nodes,
    embed_text_in_tree,
    toc_to_sections,
    repair_orphans,
)


def _make_test_data():
    return [
        {"structure": "1", "title": "Ch1: Physical World", "physical_index": 0},
        {"structure": "1.1", "title": "What is Physics?", "physical_index": 0},
        {"structure": "1.2", "title": "Scope and Excitement", "physical_index": 5},
        {"structure": "1.2.1", "title": "Classical Physics", "physical_index": 5},
        {"structure": "1.2.2", "title": "Modern Physics", "physical_index": 8},
        {"structure": "1.3", "title": "Physics and Technology", "physical_index": 12},
        {"structure": "2", "title": "Ch2: Units and Measurements", "physical_index": 18},
        {"structure": "2.1", "title": "Introduction", "physical_index": 18},
        {"structure": "2.2", "title": "SI Units", "physical_index": 22},
    ]


def _make_fake_pages(n=30):
    return [
        {"page_num": i, "text": f"Page {i} content.", "token_count": 10}
        for i in range(n)
    ]


class TestListToTree:
    def test_root_count(self):
        tree = list_to_tree(_make_test_data())
        assert len(tree) == 2

    def test_children_count(self):
        tree = list_to_tree(_make_test_data())
        assert len(tree[0]["nodes"]) == 3  # 1.1, 1.2, 1.3
        assert len(tree[1]["nodes"]) == 2  # 2.1, 2.2

    def test_nested_children(self):
        tree = list_to_tree(_make_test_data())
        sec_1_2 = tree[0]["nodes"][1]
        assert len(sec_1_2["nodes"]) == 2  # 1.2.1, 1.2.2

    def test_orphan_becomes_root(self):
        data = [
            {"structure": "3.1", "title": "Orphan", "physical_index": 0},
        ]
        tree = list_to_tree(data)
        assert len(tree) == 1
        assert tree[0]["title"] == "Orphan"

    def test_empty_input(self):
        tree = list_to_tree([])
        assert tree == []


class TestAssignPageRanges:
    def test_ranges_assigned(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)

        # First root: starts at 0
        assert tree[0]["start_index"] == 0
        # First root ends before second root starts
        assert tree[0]["end_index"] == 17
        # Second root: starts at 18, ends at 29
        assert tree[1]["start_index"] == 18
        assert tree[1]["end_index"] == 29

    def test_leaf_ranges(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)

        modern_physics = tree[0]["nodes"][1]["nodes"][1]  # 1.2.2
        assert modern_physics["start_index"] == 8
        assert modern_physics["end_index"] == 11  # up to 1.3 start - 1


class TestAssignNodeIds:
    def test_sequential_ids(self):
        tree = list_to_tree(_make_test_data())
        assign_node_ids(tree)

        assert tree[0]["node_id"] == "0001"
        assert tree[0]["nodes"][0]["node_id"] == "0002"

    def test_total_ids(self):
        tree = list_to_tree(_make_test_data())
        assign_node_ids(tree)

        ids = set()

        def collect(nodes):
            for n in nodes:
                ids.add(n["node_id"])
                collect(n.get("nodes", []))

        collect(tree)
        assert len(ids) == 9


class TestFindLargeNodes:
    def test_finds_large_by_pages(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)

        large = find_large_nodes(tree, max_pages=5)
        titles = [n["title"] for n in large]
        assert "Ch1: Physical World" in titles
        assert "Ch2: Units and Measurements" in titles

    def test_finds_large_by_tokens(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)
        pages = _make_fake_pages(30)

        large = find_large_nodes(tree, max_pages=100, max_tokens=50, pages=pages)
        assert len(large) > 0

    def test_no_large_nodes(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)

        large = find_large_nodes(tree, max_pages=100, max_tokens=999999)
        assert len(large) == 0


class TestEmbedText:
    def test_text_embedded(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)
        pages = _make_fake_pages(30)

        embed_text_in_tree(tree, pages)

        assert "text" in tree[0]
        assert "Page 0 content." in tree[0]["text"]

    def test_leaf_text(self):
        tree = list_to_tree(_make_test_data())
        assign_page_ranges(tree, total_pages=30)
        pages = _make_fake_pages(30)

        embed_text_in_tree(tree, pages)

        si_units = tree[1]["nodes"][1]  # 2.2
        assert "Page 22 content." in si_units["text"]


class TestTocToSections:
    def test_basic_toc(self):
        toc = [
            {"level": 1, "title": "Introduction", "physical_index": 0},
            {"level": 2, "title": "Background", "physical_index": 2},
            {"level": 2, "title": "Motivation", "physical_index": 5},
            {"level": 1, "title": "Methods", "physical_index": 10},
            {"level": 2, "title": "Data Collection", "physical_index": 10},
            {"level": 3, "title": "Surveys", "physical_index": 12},
        ]
        sections = toc_to_sections(toc)

        assert sections[0]["structure"] == "1"
        assert sections[0]["title"] == "Introduction"
        assert sections[1]["structure"] == "1.1"
        assert sections[2]["structure"] == "1.2"
        assert sections[3]["structure"] == "2"
        assert sections[4]["structure"] == "2.1"
        assert sections[5]["structure"] == "2.1.1"

    def test_single_level(self):
        toc = [
            {"level": 1, "title": "A", "physical_index": 0},
            {"level": 1, "title": "B", "physical_index": 5},
            {"level": 1, "title": "C", "physical_index": 10},
        ]
        sections = toc_to_sections(toc)
        assert [s["structure"] for s in sections] == ["1", "2", "3"]

    def test_builds_valid_tree(self):
        toc = [
            {"level": 1, "title": "Ch1", "physical_index": 0},
            {"level": 2, "title": "Sec1.1", "physical_index": 3},
            {"level": 2, "title": "Sec1.2", "physical_index": 7},
            {"level": 1, "title": "Ch2", "physical_index": 15},
        ]
        sections = toc_to_sections(toc)
        tree = list_to_tree(sections)
        assert len(tree) == 2
        assert len(tree[0]["nodes"]) == 2


class TestRepairOrphans:
    def test_no_orphans(self):
        data = _make_test_data()
        repaired = repair_orphans(data)
        assert len(repaired) == len(data)

    def test_inserts_missing_parent(self):
        data = [
            {"structure": "1", "title": "Ch1", "physical_index": 0},
            {"structure": "1.1", "title": "Sec1.1", "physical_index": 2},
            {"structure": "2.3.1", "title": "Deep orphan", "physical_index": 10},
        ]
        repaired = repair_orphans(data)
        structures = [s["structure"] for s in repaired]
        assert "2" in structures
        assert "2.3" in structures
        assert "2.3.1" in structures

    def test_repaired_builds_valid_tree(self):
        data = [
            {"structure": "1", "title": "Ch1", "physical_index": 0},
            {"structure": "2.1.1", "title": "Deep", "physical_index": 5},
        ]
        repaired = repair_orphans(data)
        tree = list_to_tree(repaired)
        # "2" and "2.1" should be synthesized, so 2 roots
        assert len(tree) == 2
        # "2" should have child "2.1" which has child "2.1.1"
        ch2 = tree[1]
        assert ch2["structure"] == "2"
        assert len(ch2["nodes"]) == 1
        assert ch2["nodes"][0]["structure"] == "2.1"
        assert len(ch2["nodes"][0]["nodes"]) == 1

    def test_sorted_output(self):
        data = [
            {"structure": "3.1", "title": "Late", "physical_index": 20},
            {"structure": "1.2", "title": "Early", "physical_index": 5},
        ]
        repaired = repair_orphans(data)
        structures = [s["structure"] for s in repaired]
        assert structures == ["1", "1.2", "3", "3.1"]
