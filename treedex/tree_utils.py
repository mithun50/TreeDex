import copy
import json
import re


def create_node_mapping(tree: list[dict]) -> dict:
    """Flatten tree into {node_id: node_dict} for O(1) lookups."""
    mapping = {}

    def _walk(nodes):
        for node in nodes:
            if "node_id" in node:
                mapping[node["node_id"]] = node
            _walk(node.get("nodes", []))

    _walk(tree)
    return mapping


def strip_text_from_tree(tree: list[dict]) -> list[dict]:
    """Return a deep copy of the tree with all `text` fields removed."""
    stripped = copy.deepcopy(tree)

    def _strip(nodes):
        for node in nodes:
            node.pop("text", None)
            _strip(node.get("nodes", []))

    _strip(stripped)
    return stripped


def collect_node_texts(node_ids: list[str], node_map: dict) -> str:
    """Gather and concatenate text from a list of node IDs.

    Format:
        [Section: Title]
        text

        [Section: Title2]
        text2
    """
    parts = []
    for nid in node_ids:
        node = node_map.get(nid)
        if node is None:
            continue
        title = node.get("title", "Untitled")
        structure = node.get("structure", "")
        text = node.get("text", "")
        header = f"[{structure}: {title}]" if structure else f"[{title}]"
        parts.append(f"{header}\n{text}")
    return "\n\n".join(parts)


def count_nodes(tree: list[dict]) -> int:
    """Recursively count total nodes in the tree."""
    total = 0
    for node in tree:
        total += 1
        total += count_nodes(node.get("nodes", []))
    return total


def get_leaf_nodes(tree: list[dict]) -> list[dict]:
    """Return all nodes with empty `nodes` list."""
    leaves = []

    def _walk(nodes):
        for node in nodes:
            children = node.get("nodes", [])
            if not children:
                leaves.append(node)
            else:
                _walk(children)

    _walk(tree)
    return leaves


def tree_to_flat_list(tree: list[dict]) -> list[dict]:
    """Flatten hierarchy back to a list in DFS order."""
    result = []

    def _walk(nodes):
        for node in nodes:
            flat = {k: v for k, v in node.items() if k != "nodes"}
            result.append(flat)
            _walk(node.get("nodes", []))

    _walk(tree)
    return result


def extract_json(text: str):
    """Robust JSON extraction from LLM responses.

    Handles raw JSON, ```json code blocks, and minor formatting issues
    like trailing commas.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if match:
        block = match.group(1).strip()
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            cleaned = re.sub(r",\s*([}\]])", r"\1", block)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass

    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == start_char:
                depth += 1
            elif text[i] == end_char:
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
                        try:
                            return json.loads(cleaned)
                        except json.JSONDecodeError:
                            break

    raise ValueError(f"Could not extract JSON from text: {text[:200]}...")


def print_tree(tree: list[dict], indent: int = 0):
    """Pretty-print tree structure for debugging."""
    prefix = "  " * indent
    for node in tree:
        node_id = node.get("node_id", "????")
        structure = node.get("structure", "")
        title = node.get("title", "Untitled")
        start = node.get("start_index", "?")
        end = node.get("end_index", "?")
        print(f"{prefix}[{node_id}] {structure}: {title} (pages {start}-{end})")
        print_tree(node.get("nodes", []), indent + 1)
