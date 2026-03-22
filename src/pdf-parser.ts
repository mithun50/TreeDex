/** PDF extraction and page grouping. */

import { encode } from "gpt-tokenizer";
import type { Page } from "./types.js";

/** Count tokens using cl100k_base-compatible encoding. */
export function countTokens(text: string): number {
  return encode(text).length;
}

// ---------------------------------------------------------------------------
// ToC extraction
// ---------------------------------------------------------------------------

export interface TocEntry {
  level: number;
  title: string;
  physical_index: number;
}

/**
 * Extract table of contents from PDF outline/bookmarks.
 *
 * Returns an array of `{level, title, physical_index}` or `null` if the PDF
 * has no usable outline (fewer than 3 entries).
 */
export async function extractToc(pdfPath: string): Promise<TocEntry[] | null> {
  const fs = await import("node:fs/promises");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const buf = await fs.readFile(pdfPath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await pdfjs.getDocument({ data }).promise;

  const outline = await doc.getOutline();
  if (!outline || outline.length === 0) return null;

  // Flatten the nested outline into (level, title, dest) tuples
  const entries: TocEntry[] = [];

  async function walkOutline(
    items: Array<{
      title: string;
      dest: unknown;
      items?: unknown[];
    }>,
    level: number,
  ): Promise<void> {
    for (const item of items) {
      const title = (item.title ?? "").trim();
      if (!title) continue;

      let pageIndex = 0;
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await doc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest[0]) {
          const ref = dest[0];
          pageIndex = await doc.getPageIndex(ref);
        }
      } catch {
        // Destination resolution can fail — default to page 0
      }

      entries.push({ level, title, physical_index: Math.max(pageIndex, 0) });

      if (Array.isArray(item.items) && item.items.length > 0) {
        await walkOutline(
          item.items as Array<{ title: string; dest: unknown; items?: unknown[] }>,
          level + 1,
        );
      }
    }
  }

  await walkOutline(outline, 1);
  return entries.length >= 3 ? entries : null;
}

// ---------------------------------------------------------------------------
// Font-size heading detection
// ---------------------------------------------------------------------------

interface TextItemLike {
  str?: string;
  transform?: number[];
  height?: number;
}

/**
 * Analyze font sizes across the document (samples up to 50 pages).
 * Returns a map of `{roundedFontSize: "H1"/"H2"/"H3"}`.
 */
async function analyzeHeadingSizes(
  doc: { numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }> },
): Promise<Map<number, string>> {
  const sizeChars = new Map<number, number>();
  const sampleLimit = Math.min(doc.numPages, 50);

  for (let i = 0; i < sampleLimit; i++) {
    const page = await doc.getPage(i + 1);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const item = raw as TextItemLike;
      const text = (item.str ?? "").trim();
      if (!text) continue;
      // Font size from transform matrix: transform[3] is the vertical scale
      const fontSize = Math.round(((item.transform?.[3]) ?? item.height ?? 0) * 10) / 10;
      if (fontSize > 0) {
        sizeChars.set(fontSize, (sizeChars.get(fontSize) ?? 0) + text.length);
      }
    }
  }

  if (sizeChars.size === 0) return new Map();

  // Body text = most common font size by character count
  let bodySize = 0;
  let maxChars = 0;
  for (const [size, chars] of sizeChars) {
    if (chars > maxChars) {
      bodySize = size;
      maxChars = chars;
    }
  }

  // Heading sizes = sizes larger than body, sorted descending
  const headingSizes = [...sizeChars.keys()]
    .filter((s) => s > bodySize + 0.5)
    .sort((a, b) => b - a);

  if (headingSizes.length === 0) return new Map();

  const mapping = new Map<number, string>();
  for (let i = 0; i < Math.min(headingSizes.length, 3); i++) {
    mapping.set(headingSizes[i], `H${i + 1}`);
  }
  return mapping;
}

/**
 * Build page text with `[H1]`/`[H2]`/`[H3]` heading markers from text items.
 */
function buildAnnotatedText(
  items: unknown[],
  headingMap: Map<number, string>,
): string {
  // Group items into lines — items on the same Y coordinate belong to the same line
  const lines: Array<{ y: number; parts: Array<{ text: string; tag: string | null }> }> = [];

  for (const raw of items) {
    const item = raw as TextItemLike;
    const text = item.str ?? "";
    if (!text) continue;

    const fontSize = Math.round(((item.transform?.[3]) ?? item.height ?? 0) * 10) / 10;
    const y = Math.round((item.transform?.[5] ?? 0) * 10) / 10;
    const tag = headingMap.get(fontSize) ?? null;

    // Find or create a line for this Y coordinate
    let line = lines.find((l) => Math.abs(l.y - y) < 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ text, tag: text.trim() ? tag : null });
  }

  // Sort lines top-to-bottom (higher Y = higher on page in PDF coordinates)
  lines.sort((a, b) => b.y - a.y);

  const result: string[] = [];
  for (const line of lines) {
    const lineText = line.parts.map((p) => p.text).join(" ").trim();
    if (!lineText) continue;

    // Pick the highest-priority tag on this line
    let bestTag: string | null = null;
    for (const p of line.parts) {
      if (p.tag && (bestTag === null || p.tag < bestTag)) {
        bestTag = p.tag;
      }
    }

    if (bestTag) {
      result.push(`[${bestTag}] ${lineText}`);
    } else {
      result.push(lineText);
    }
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Page extraction
// ---------------------------------------------------------------------------

/**
 * Extract text from each page of a PDF.
 *
 * Returns a list of objects with page_num, text, token_count, and optionally images.
 *
 * When `detectHeadings` is true the text of each page will contain
 * `[H1]`/`[H2]`/`[H3]` markers before heading lines, determined by
 * font-size analysis across the document.
 */
export async function extractPages(
  pdfPath: string,
  options?: { extractImages?: boolean; detectHeadings?: boolean },
): Promise<Page[]> {
  const fs = await import("node:fs/promises");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const buf = await fs.readFile(pdfPath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await pdfjs.getDocument({ data }).promise;

  // pdfjs OPS constants for image painting
  const OPS_PAINT_IMAGE = 85;  // paintImageXObject
  const OPS_PAINT_JPEG = 82;   // paintJpegXObject

  // Optionally detect heading font sizes
  const headingMap = options?.detectHeadings
    ? await analyzeHeadingSizes(doc)
    : new Map<number, string>();

  const pages: Page[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1); // pdfjs is 1-indexed
    const content = await page.getTextContent();

    let text: string;
    if (headingMap.size > 0) {
      text = buildAnnotatedText(content.items, headingMap);
    } else {
      text = content.items
        .map((item: unknown) => {
          const obj = item as Record<string, unknown>;
          return typeof obj.str === "string" ? obj.str : "";
        })
        .join(" ");
    }

    const pageObj: Page = {
      page_num: i,
      text,
      token_count: countTokens(text),
    };

    if (options?.extractImages) {
      try {
        const opList = await page.getOperatorList();
        const images: Page["images"] = [];
        let imgIndex = 0;

        for (let j = 0; j < opList.fnArray.length; j++) {
          const op = opList.fnArray[j];
          if (op === OPS_PAINT_IMAGE || op === OPS_PAINT_JPEG) {
            const imgName = opList.argsArray[j]?.[0];
            if (typeof imgName === "string") {
              images.push({
                data: "",
                mime_type: op === OPS_PAINT_JPEG ? "image/jpeg" : "image/unknown",
                alt_text: `[Embedded image ${imgIndex + 1} on page ${i + 1}]`,
                index_on_page: imgIndex,
              });
              imgIndex++;
            }
          }
        }

        if (images.length > 0) {
          pageObj.images = images;
        }
      } catch {
        // Ignore image extraction errors
      }
    }

    pages.push(pageObj);
  }

  return pages;
}

/**
 * Combine pages[start:end+1] into a string with physical index tags.
 *
 * Each page is wrapped like:
 *     <physical_index_0>page text</physical_index_0>
 * where the number is the page's page_num.
 */
export function pagesToTaggedText(
  pages: Page[],
  start: number,
  end: number,
): string {
  const parts: string[] = [];
  for (const page of pages.slice(start, end + 1)) {
    const n = page.page_num;
    parts.push(`<physical_index_${n}>${page.text}</physical_index_${n}>`);
  }
  return parts.join("\n");
}

/**
 * Split pages into token-budget groups, each returned as tagged text.
 *
 * Groups overlap by `overlap` pages for continuity.
 */
export function groupPages(
  pages: Page[],
  maxTokens: number = 20000,
  overlap: number = 1,
): string[] {
  const totalTokens = pages.reduce((sum, p) => sum + p.token_count, 0);

  if (totalTokens <= maxTokens) {
    return [pagesToTaggedText(pages, 0, pages.length - 1)];
  }

  const groups: string[] = [];
  let groupStart = 0;

  while (groupStart < pages.length) {
    let running = 0;
    let groupEnd = groupStart;

    while (groupEnd < pages.length) {
      const pageTokens = pages[groupEnd].token_count;
      if (running + pageTokens > maxTokens && groupEnd > groupStart) {
        groupEnd -= 1;
        break;
      }
      running += pageTokens;
      groupEnd += 1;
    }

    if (groupEnd >= pages.length) {
      groupEnd = pages.length - 1;
    }

    groupEnd = Math.min(groupEnd, pages.length - 1);
    groups.push(pagesToTaggedText(pages, groupStart, groupEnd));

    if (groupEnd >= pages.length - 1) {
      break;
    }

    const nextStart = groupEnd + 1 - overlap;
    groupStart = Math.max(nextStart, groupStart + 1);
  }

  return groups;
}
