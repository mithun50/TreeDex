def toc_to_sections(toc: list[dict]) -> list[dict]:
    """Convert ToC entries ``{level, title, physical_index}`` into flat
    sections with hierarchical ``structure`` numbering (``"1"``, ``"1.2"``,
    ``"1.2.3"``).
    """
    counters: dict[int, int] = {}
    sections: list[dict] = []

    for entry in toc:
        level = entry["level"]

        # Reset deeper counters
        for k in list(counters):
            if k > level:
                del counters[k]

        counters[level] = counters.get(level, 0) + 1

        parts = [str(counters.get(l, 1)) for l in range(1, level + 1)]

        sections.append({
            "structure": ".".join(parts),
            "title": entry["title"],
            "physical_index": entry["physical_index"],
        })

    return sections


def repair_orphans(flat_list: list[dict]) -> list[dict]:
    """Repair orphaned sections by inserting synthetic parent nodes.

    If ``"2.3.1"`` exists but ``"2.3"`` doesn't, a synthetic ``"2.3"`` node
    is inserted so that ``list_to_tree`` can build the correct hierarchy.
    """
    known = {item["structure"] for item in flat_list}
    inserts: list[dict] = []

    for item in flat_list:
        parts = item["structure"].split(".")
        for depth in range(1, len(parts)):
            ancestor = ".".join(parts[:depth])
            if ancestor not in known:
                inserts.append({
                    "structure": ancestor,
                    "title": f"Section {ancestor}",
                    "physical_index": item["physical_index"],
                })
                known.add(ancestor)

    if inserts:
        combined = flat_list + inserts
        combined.sort(key=lambda x: [int(p) for p in x["structure"].split(".")])
        return combined

    return flat_list


def list_to_tree(flat_list: list[dict]) -> list[dict]:
    """Convert a flat list with `structure` fields into a hierarchical tree.

    Each item must have a `structure` field like "1", "1.1", "1.2.3".
    Parent of "1.2.3" is "1.2", parent of "1.2" is "1", "1" is root.
    Output nodes get a `nodes: []` field for children.
    """
    nodes_by_structure = {}
    roots = []

    for item in flat_list:
        node = {**item, "nodes": []}
        structure = node["structure"]
        nodes_by_structure[structure] = node

        parts = structure.rsplit(".", 1)
        if len(parts) == 1:
            roots.append(node)
        else:
            parent_structure = parts[0]
            parent = nodes_by_structure.get(parent_structure)
            if parent is not None:
                parent["nodes"].append(node)
            else:
                roots.append(node)

    return roots


def _assign_ranges(nodes: list[dict], boundary_end: int):
    """Recursively assign start_index and end_index to nodes."""
    for i, node in enumerate(nodes):
        node["start_index"] = node.get("physical_index", 0)

        if i + 1 < len(nodes):
            node["end_index"] = nodes[i + 1].get("physical_index", 0) - 1
        else:
            node["end_index"] = boundary_end

        # Clamp: end must be >= start (sections on the same page)
        if node["end_index"] < node["start_index"]:
            node["end_index"] = node["start_index"]

        if node.get("nodes"):
            _assign_ranges(node["nodes"], node["end_index"])


def assign_page_ranges(tree: list[dict], total_pages: int) -> list[dict]:
    """Set start_index and end_index on each node.

    - start_index = node's physical_index
    - end_index = next sibling's physical_index - 1, or parent's end,
      or total_pages - 1 for the last root node
    """
    _assign_ranges(tree, total_pages - 1)
    return tree


def assign_node_ids(tree: list[dict]) -> list[dict]:
    """DFS traversal, assigns sequential IDs: '0001', '0002', etc."""
    counter = [0]

    def _walk(nodes):
        for node in nodes:
            counter[0] += 1
            node["node_id"] = f"{counter[0]:04d}"
            _walk(node.get("nodes", []))

    _walk(tree)
    return tree


def find_large_nodes(
    tree: list[dict],
    max_pages: int = 10,
    max_tokens: int = 20000,
    pages: list[dict] | None = None,
) -> list[dict]:
    """Return nodes that exceed page or token thresholds."""
    large = []

    def _walk(nodes):
        for node in nodes:
            start = node.get("start_index", 0)
            end = node.get("end_index", 0)
            page_count = end - start + 1

            is_large = page_count > max_pages

            if not is_large and pages is not None:
                token_sum = sum(
                    p["token_count"]
                    for p in pages
                    if start <= p["page_num"] <= end
                )
                is_large = token_sum > max_tokens

            if is_large:
                large.append(node)

            _walk(node.get("nodes", []))

    _walk(tree)
    return large


def embed_text_in_tree(tree: list[dict], pages: list[dict]) -> list[dict]:
    """Add `text` field to each node by concatenating page text for its range."""

    def _walk(nodes):
        for node in nodes:
            start = node.get("start_index", 0)
            end = node.get("end_index", 0)
            node["text"] = "\n".join(
                p["text"] for p in pages if start <= p["page_num"] <= end
            )
            _walk(node.get("nodes", []))

    _walk(tree)
    return tree
