/** Prompt templates for structure extraction and retrieval. */

export function structureExtractionPrompt(text: string): string {
  return `You are a document structure analyzer. Given the following document text with \
physical page index tags, extract the hierarchical structure (table of contents).

Return a JSON list of objects, each with:
- "structure": hierarchical numbering like "1", "1.1", "1.2.3"
- "title": the section/chapter title
- "physical_index": the page number (from the <physical_index_N> tag) where this section starts

Rules:
- Use the physical_index tags to determine page numbers
- Create a logical hierarchy: chapters -> sections -> subsections
- If the text contains heading markers like [H1], [H2], [H3], use them to determine hierarchy depth:
  - [H1] = top-level chapters/parts (structure: "1", "2", "3")
  - [H2] = sections within a chapter (structure: "1.1", "1.2")
  - [H3] = subsections (structure: "1.1.1", "1.1.2")
- Every section must have a unique structure ID
- Return ONLY valid JSON — no extra text

Document text:
${text}

JSON output:
`;
}

export function structureContinuePrompt(
  previousStructure: string,
  text: string,
): string {
  return `You are continuing to extract the hierarchical structure of a document.

Here is the structure extracted so far (may be summarized for long documents):
${previousStructure}

Now extract the structure from the next portion of the document. \
Continue the numbering from where the previous structure left off. \
If a section from the previous portion continues into this portion, \
do NOT duplicate it.

Important:
- Maintain the correct hierarchy depth throughout
- If heading markers [H1], [H2], [H3] are present, use them as the primary signal for depth:
  - [H1] = top-level chapters/parts (structure: "N")
  - [H2] = sections within a chapter (structure: "N.M")
  - [H3] = subsections (structure: "N.M.K")
- Do NOT flatten subsections to the top level

Return a JSON list of NEW sections only (same format as before).

Document text:
${text}

JSON output:
`;
}

export function answerPrompt(
  context: string,
  query: string,
): string {
  return `You are a knowledgeable assistant. Answer the user's question based ONLY on the \
provided document context below. Extract the relevant information and give a clear, \
direct answer.

Document context:
---
${context}
---

Question: ${query}

Give a concise, accurate answer using only the information from the document context above. \
Include specific details, numbers, or facts from the text when available.

Answer:
`;
}

export function retrievalPrompt(
  treeStructure: string,
  query: string,
): string {
  return `You are a document retrieval system. Given a document's tree structure and a \
user query, select the most relevant sections that would contain the answer.

Document structure:
${treeStructure}

User query: ${query}

Return a JSON object with:
- "node_ids": list of node IDs (strings like "0001", "0005") that are most \
relevant to the query
- "reasoning": one short sentence explaining which sections were picked and why

Select the smallest set of sections that fully covers the answer. \
Prefer leaf nodes over parent nodes when the leaf contains the specific content. \
Return ONLY valid JSON.

JSON output:
`;
}

export function imageDescriptionPrompt(): string {
  return `Describe this image concisely in 1-2 sentences. Focus on:
- What the image shows (diagram, chart, photo, table, etc.)
- Key information visible (labels, data points, text)
- Its likely purpose in a document context

Be factual and specific. Do not speculate beyond what is visible.

Description:
`;
}
