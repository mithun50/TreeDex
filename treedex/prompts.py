"""Prompt templates for structure extraction and retrieval."""

STRUCTURE_EXTRACTION_PROMPT = """\
You are a document structure analyzer. Given the following document text with \
physical page index tags, extract the hierarchical structure (table of contents).

Return a JSON list of objects, each with:
- "structure": hierarchical numbering like "1", "1.1", "1.2.3"
- "title": the section/chapter title
- "physical_index": the page number (from the <physical_index_N> tag) where this section starts

Rules:
- Use the physical_index tags to determine page numbers
- Create a logical hierarchy: chapters -> sections -> subsections
- Every section must have a unique structure ID
- Return ONLY valid JSON — no extra text

Document text:
{text}

JSON output:
"""

STRUCTURE_CONTINUE_PROMPT = """\
You are continuing to extract the hierarchical structure of a document.

Here is the structure extracted so far:
{previous_structure}

Now extract the structure from the next portion of the document. \
Continue the numbering from where the previous structure left off. \
If a section from the previous portion continues into this portion, \
do NOT duplicate it.

Return a JSON list of NEW sections only (same format as before).

Document text:
{text}

JSON output:
"""

ANSWER_PROMPT = """\
You are a knowledgeable assistant. Answer the user's question based ONLY on the \
provided context. Be accurate, concise, and helpful.

If the context does not contain enough information to answer the question, say so clearly.

Context:
{context}

Question: {query}

Answer:
"""

RETRIEVAL_PROMPT = """\
You are a document retrieval system. Given a document's tree structure and a \
user query, select the most relevant sections that would contain the answer.

Document structure:
{tree_structure}

User query: {query}

Return a JSON object with:
- "node_ids": list of node IDs (strings like "0001", "0005") that are most \
relevant to the query
- "reasoning": brief explanation of why these sections were selected

Select the smallest set of sections that fully covers the answer. \
Prefer leaf nodes over parent nodes when the leaf contains the specific content. \
Return ONLY valid JSON.

JSON output:
"""
