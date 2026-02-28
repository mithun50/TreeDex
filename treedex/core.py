"""TreeDex: Tree-based document RAG framework."""

import json
import os

from treedex.loaders import auto_loader, PDFLoader
from treedex.pdf_parser import group_pages
from treedex.tree_builder import (
    assign_node_ids,
    assign_page_ranges,
    embed_text_in_tree,
    find_large_nodes,
    list_to_tree,
)
from treedex.tree_utils import (
    collect_node_texts,
    count_nodes,
    create_node_mapping,
    extract_json,
    get_leaf_nodes,
    print_tree,
    strip_text_from_tree,
)
from treedex.prompts import (
    STRUCTURE_EXTRACTION_PROMPT,
    STRUCTURE_CONTINUE_PROMPT,
    RETRIEVAL_PROMPT,
)


class QueryResult:
    """Result of a TreeDex query."""

    def __init__(self, context: str, node_ids: list[str],
                 page_ranges: list, reasoning: str):
        self.context = context
        self.node_ids = node_ids
        self.page_ranges = page_ranges
        self.reasoning = reasoning

    @property
    def pages_str(self) -> str:
        """Human-readable page ranges like 'pages 5-8, 12-15'."""
        if not self.page_ranges:
            return "no pages"
        parts = []
        for start, end in self.page_ranges:
            if start == end:
                parts.append(str(start + 1))
            else:
                parts.append(f"{start + 1}-{end + 1}")
        return "pages " + ", ".join(parts)

    def __repr__(self):
        return (
            f"QueryResult(nodes={self.node_ids}, {self.pages_str}, "
            f"context_len={len(self.context)})"
        )


class TreeDex:
    """Tree-based document index for RAG retrieval."""

    def __init__(self, tree: list[dict], pages: list[dict],
                 llm=None):
        self.tree = tree
        self.pages = pages
        self.llm = llm
        self._node_map = create_node_mapping(tree)

    @classmethod
    def from_file(cls, path: str, llm, loader=None,
                  max_tokens: int = 20000, overlap: int = 1,
                  verbose: bool = True):
        """Build a TreeDex index from a file.

        Args:
            path: Path to document (PDF, TXT, HTML, DOCX)
            llm: LLM backend with .generate(prompt) method
            loader: Optional loader instance. Auto-detected if None.
            max_tokens: Max tokens per page group for structure extraction
            overlap: Page overlap between groups
            verbose: Print progress info
        """
        if verbose:
            print(f"Loading: {os.path.basename(path)}")

        if loader is not None:
            pages = loader.load(path)
        else:
            pages = auto_loader(path)

        if verbose:
            total_tokens = sum(p["token_count"] for p in pages)
            print(f"  {len(pages)} pages, {total_tokens:,} tokens")

        return cls.from_pages(pages, llm, max_tokens=max_tokens,
                              overlap=overlap, verbose=verbose)

    @classmethod
    def from_pages(cls, pages: list[dict], llm,
                   max_tokens: int = 20000, overlap: int = 1,
                   verbose: bool = True):
        """Build a TreeDex index from pre-extracted pages."""
        groups = group_pages(pages, max_tokens=max_tokens, overlap=overlap)

        if verbose:
            print(f"  {len(groups)} page group(s) for structure extraction")

        # Extract structure from each group
        all_sections = []
        for i, group_text in enumerate(groups):
            if verbose:
                print(f"  Extracting structure from group {i + 1}/{len(groups)}...")

            if i == 0:
                prompt = STRUCTURE_EXTRACTION_PROMPT.format(text=group_text)
            else:
                prev_json = json.dumps(all_sections, indent=2)
                prompt = STRUCTURE_CONTINUE_PROMPT.format(
                    previous_structure=prev_json, text=group_text
                )

            response = llm.generate(prompt)
            sections = extract_json(response)

            if isinstance(sections, list):
                all_sections.extend(sections)
            elif isinstance(sections, dict) and "sections" in sections:
                all_sections.extend(sections["sections"])

        if verbose:
            print(f"  Extracted {len(all_sections)} sections")

        # Build tree
        tree = list_to_tree(all_sections)
        assign_page_ranges(tree, total_pages=len(pages))
        assign_node_ids(tree)
        embed_text_in_tree(tree, pages)

        if verbose:
            print(f"  Tree: {count_nodes(tree)} nodes")

        return cls(tree, pages, llm)

    @classmethod
    def from_tree(cls, tree: list[dict], pages: list[dict], llm=None):
        """Create a TreeDex from an existing tree and pages."""
        return cls(tree, pages, llm)

    def query(self, question: str, llm=None) -> QueryResult:
        """Query the index and return relevant context.

        Args:
            question: The user's question
            llm: Optional LLM override. Uses self.llm if None.
        """
        active_llm = llm or self.llm
        if active_llm is None:
            raise ValueError("No LLM provided. Pass llm= to query() or TreeDex constructor.")

        # Build lightweight tree structure for the prompt
        stripped = strip_text_from_tree(self.tree)
        tree_json = json.dumps(stripped, indent=2)

        prompt = RETRIEVAL_PROMPT.format(
            tree_structure=tree_json, query=question
        )

        response = active_llm.generate(prompt)
        result = extract_json(response)

        node_ids = result.get("node_ids", [])
        reasoning = result.get("reasoning", "")

        # Collect context text and page ranges
        context = collect_node_texts(node_ids, self._node_map)

        page_ranges = []
        for nid in node_ids:
            node = self._node_map.get(nid)
            if node:
                start = node.get("start_index", 0)
                end = node.get("end_index", 0)
                page_ranges.append((start, end))

        return QueryResult(
            context=context,
            node_ids=node_ids,
            page_ranges=page_ranges,
            reasoning=reasoning,
        )

    def save(self, path: str) -> str:
        """Save the index to a JSON file."""
        stripped = strip_text_from_tree(self.tree)

        data = {
            "version": "1.0",
            "framework": "TreeDex",
            "tree": stripped,
            "pages": self.pages,
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        return path

    @classmethod
    def load(cls, path: str, llm=None):
        """Load a TreeDex index from a JSON file."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        tree = data["tree"]
        pages = data["pages"]

        # Re-embed text from pages
        assign_page_ranges(tree, total_pages=len(pages))
        embed_text_in_tree(tree, pages)

        return cls(tree, pages, llm)

    def show_tree(self):
        """Pretty-print the tree structure."""
        print_tree(self.tree)

    def stats(self) -> dict:
        """Return index statistics."""
        total_tokens = sum(p["token_count"] for p in self.pages)
        leaves = get_leaf_nodes(self.tree)
        return {
            "total_pages": len(self.pages),
            "total_tokens": total_tokens,
            "total_nodes": count_nodes(self.tree),
            "leaf_nodes": len(leaves),
            "root_sections": len(self.tree),
        }

    def find_large_sections(self, max_pages: int = 10,
                            max_tokens: int = 20000) -> list[dict]:
        """Find sections that exceed size thresholds."""
        return find_large_nodes(
            self.tree, max_pages=max_pages,
            max_tokens=max_tokens, pages=self.pages
        )
