"""TreeDex: Tree-based document RAG framework."""

import json
import os

from treedex.loaders import auto_loader, PDFLoader
from treedex.pdf_parser import group_pages, extract_toc
from treedex.tree_builder import (
    assign_node_ids,
    assign_page_ranges,
    embed_text_in_tree,
    find_large_nodes,
    list_to_tree,
    repair_orphans,
    toc_to_sections,
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
    ANSWER_PROMPT,
    IMAGE_DESCRIPTION_PROMPT,
)


def _describe_images(pages: list[dict], llm=None, verbose: bool = False) -> None:
    """Append image descriptions to page text, modifying pages in place."""
    from treedex.loaders import _count_tokens

    for page in pages:
        images = page.get("images")
        if not images:
            continue

        descriptions = []
        for img in images:
            alt = img.get("alt_text", "").strip()
            if alt:
                descriptions.append(f"[Image: {alt}]")
            elif llm is not None and getattr(llm, "supports_vision", False) and img.get("data"):
                try:
                    desc = llm.generate_with_image(
                        IMAGE_DESCRIPTION_PROMPT,
                        img["data"],
                        img["mime_type"],
                    )
                    descriptions.append(f"[Image: {desc.strip()}]")
                except Exception:
                    descriptions.append("[Image present]")
            else:
                descriptions.append("[Image present]")

        if descriptions:
            page["text"] = page["text"] + "\n" + "\n".join(descriptions)
            page["token_count"] = _count_tokens(page["text"])

        if verbose and descriptions:
            print(f"  Page {page['page_num']}: {len(descriptions)} image(s) described")


def _build_continuation_context(
    all_sections: list[dict],
    max_recent: int = 30,
) -> str:
    """Build a capped continuation context for structure extraction.

    For small section lists, returns the full JSON.  For large lists, returns
    a summary with top-level sections and the most recent *max_recent*
    detailed sections so the LLM doesn't get overwhelmed.
    """
    if len(all_sections) <= max_recent:
        return json.dumps(all_sections, indent=2)

    top_level = [s for s in all_sections if "." not in s["structure"]]
    recent = all_sections[-max_recent:]

    summary = {
        "top_level_sections": top_level,
        "recent_sections (last {})".format(max_recent): recent,
        "total_sections_so_far": len(all_sections),
        "last_structure_id": all_sections[-1]["structure"],
    }
    return json.dumps(summary, indent=2)


class QueryResult:
    """Result of a TreeDex query."""

    def __init__(self, context: str, node_ids: list[str],
                 page_ranges: list, reasoning: str, answer: str = ""):
        self.context = context
        self.node_ids = node_ids
        self.page_ranges = page_ranges
        self.reasoning = reasoning
        self.answer = answer

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


class MultiQueryResult:
    """Result of querying multiple TreeDex indexes simultaneously.

    Attributes:
        results: Per-index QueryResult objects in the same order as the
            input indexes.
        labels: Human-readable label for each index (e.g. filenames).
        combined_context: All per-index contexts merged with
            ``[Document N]`` separators for easy downstream consumption.
        answer: Optional agentic answer generated over the combined context.
    """

    def __init__(
        self,
        results: list[QueryResult],
        labels: list[str],
        combined_context: str,
        answer: str = "",
    ):
        self.results = results
        self.labels = labels
        self.combined_context = combined_context
        self.answer = answer

    def __repr__(self) -> str:
        parts = [f"[{self.labels[i]}] {repr(r)}" for i, r in enumerate(self.results)]
        return "MultiQueryResult(\n  " + ",\n  ".join(parts) + "\n)"


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
                  verbose: bool = True, extract_images: bool = False):
        """Build a TreeDex index from a file.

        Args:
            path: Path to document (PDF, TXT, HTML, DOCX)
            llm: LLM backend with .generate(prompt) method
            loader: Optional loader instance. Auto-detected if None.
            max_tokens: Max tokens per page group for structure extraction
            overlap: Page overlap between groups
            verbose: Print progress info
            extract_images: Extract images from PDFs for vision LLM description
        """
        if verbose:
            print(f"Loading: {os.path.basename(path)}")

        is_pdf = path.lower().endswith(".pdf")

        # --- Try PDF ToC shortcut ---
        toc = None
        if is_pdf and loader is None:
            toc = extract_toc(path)
            if toc and verbose:
                print(f"  Found PDF table of contents ({len(toc)} entries)")

        # Load pages — enable heading detection for PDFs when no ToC
        if loader is not None:
            pages = loader.load(path)
        else:
            pages = auto_loader(
                path,
                extract_images=extract_images,
                detect_headings=is_pdf and toc is None,
            )

        if verbose:
            total_tokens = sum(p["token_count"] for p in pages)
            print(f"  {len(pages)} pages, {total_tokens:,} tokens")

        # If we have a ToC, build the tree directly — no LLM needed
        if toc:
            return cls._from_toc(toc, pages, llm, verbose=verbose)

        return cls.from_pages(pages, llm, max_tokens=max_tokens,
                              overlap=overlap, verbose=verbose)

    @classmethod
    def _from_toc(cls, toc: list[dict], pages: list[dict], llm,
                  verbose: bool = True):
        """Build a TreeDex index directly from PDF table of contents."""
        sections = toc_to_sections(toc)

        if verbose:
            print(f"  Built {len(sections)} sections from PDF ToC (no LLM needed)")

        tree = list_to_tree(sections)
        assign_page_ranges(tree, total_pages=len(pages))
        assign_node_ids(tree)
        embed_text_in_tree(tree, pages)

        if verbose:
            print(f"  Tree: {count_nodes(tree)} nodes")

        return cls(tree, pages, llm)

    @classmethod
    def from_pages(cls, pages: list[dict], llm,
                   max_tokens: int = 20000, overlap: int = 1,
                   verbose: bool = True):
        """Build a TreeDex index from pre-extracted pages."""
        # Describe images before grouping — appends text markers to pages
        _describe_images(pages, llm=llm, verbose=verbose)

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
                prev_context = _build_continuation_context(all_sections)
                prompt = STRUCTURE_CONTINUE_PROMPT.format(
                    previous_structure=prev_context, text=group_text
                )

            response = llm.generate(prompt)
            sections = extract_json(response)

            if isinstance(sections, list):
                all_sections.extend(sections)
            elif isinstance(sections, dict) and "sections" in sections:
                all_sections.extend(sections["sections"])

        if verbose:
            print(f"  Extracted {len(all_sections)} sections")

        # Repair orphaned sections before building the tree
        all_sections = repair_orphans(all_sections)

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

    def query(self, question: str, llm=None, agentic: bool = False) -> QueryResult:
        """Query the index and return relevant context.

        Args:
            question: The user's question
            llm: Optional LLM override. Uses self.llm if None.
            agentic: If True, generate an answer from retrieved context.
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

        # Agentic mode: generate an answer from the retrieved context
        answer = ""
        if agentic and context:
            answer_prompt = ANSWER_PROMPT.format(context=context, query=question)
            answer = active_llm.generate(answer_prompt)

        return QueryResult(
            context=context,
            node_ids=node_ids,
            page_ranges=page_ranges,
            reasoning=reasoning,
            answer=answer,
        )

    def save(self, path: str) -> str:
        """Save the index to a JSON file."""
        stripped = strip_text_from_tree(self.tree)

        # Strip images from pages — descriptions are already in text
        clean_pages = []
        for p in self.pages:
            cp = {k: v for k, v in p.items() if k != "images"}
            clean_pages.append(cp)

        data = {
            "version": "1.0",
            "framework": "TreeDex",
            "tree": stripped,
            "pages": clean_pages,
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

    @classmethod
    def query_all(
        cls,
        indexes: list["TreeDex"],
        question: str,
        llm=None,
        agentic: bool = False,
        labels: list[str] | None = None,
    ) -> "MultiQueryResult":
        """Query multiple TreeDex indexes simultaneously and merge results.

        All indexes are queried sequentially and results are combined into a
        single :class:`MultiQueryResult` whose ``combined_context`` labels
        each source document clearly.

        Args:
            indexes: List of TreeDex instances to query.
            question: The question to ask every index.
            llm: Shared LLM instance. Falls back to each index's own LLM when
                not provided.
            agentic: If ``True``, generate a single answer over the combined
                context using the LLM after all retrievals are done.
            labels: Human-readable names for each index (e.g. filenames).
                Defaults to ``"Document 1"``, ``"Document 2"``, …

        Returns:
            A :class:`MultiQueryResult` with per-index results, merged
            context, and an optional agentic answer.

        Example::

            multi = TreeDex.query_all(
                [index1, index2, index3],
                "What are the safety guidelines?",
                llm=llm,
                labels=["Manual A", "Manual B", "Manual C"],
                agentic=True,
            )
            print(multi.combined_context)
            print(multi.answer)
        """
        if not indexes:
            raise ValueError("query_all requires at least one index.")

        if labels is None:
            labels = [f"Document {i + 1}" for i in range(len(indexes))]

        if len(labels) != len(indexes):
            raise ValueError("labels length must match indexes length.")

        if llm is None and any(idx.llm is None for idx in indexes):
            raise ValueError(
                "No LLM provided for one or more indexes. Pass llm= to "
                "query_all() or set llm on every TreeDex instance."
            )

        # Query each index (no per-index agentic; single answer at the end)
        results = [
            idx.query(question, llm=llm, agentic=False)
            for idx in indexes
        ]

        # Merge contexts with clear document separators
        sections = []
        for i, result in enumerate(results):
            ctx = result.context.strip()
            if ctx:
                sections.append(f"[{labels[i]}]\n{ctx}")
        combined_context = "\n\n---\n\n".join(sections)

        # Optional: generate one answer over the combined context
        answer = ""
        if agentic and combined_context:
            active_llm = llm or next(
                (idx.llm for idx in indexes if idx.llm is not None), None
            )
            if active_llm is None:
                raise ValueError("No LLM provided for agentic mode in query_all.")
            prompt = ANSWER_PROMPT.format(context=combined_context, query=question)
            answer = active_llm.generate(prompt)

        return MultiQueryResult(results, labels, combined_context, answer)
