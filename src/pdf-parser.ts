/** PDF extraction and page grouping. */

import { encode } from "gpt-tokenizer";
import type { Page } from "./types.js";

/** Count tokens using cl100k_base-compatible encoding. */
export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Extract text from each page of a PDF.
 *
 * Returns a list of objects with page_num, text, token_count, and optionally images.
 */
export async function extractPages(
  pdfPath: string,
  options?: { extractImages?: boolean },
): Promise<Page[]> {
  const fs = await import("node:fs/promises");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const buf = await fs.readFile(pdfPath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await pdfjs.getDocument({ data }).promise;

  // pdfjs OPS constants for image painting
  const OPS_PAINT_IMAGE = 85;  // paintImageXObject
  const OPS_PAINT_JPEG = 82;   // paintJpegXObject

  const pages: Page[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1); // pdfjs is 1-indexed
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return typeof obj.str === "string" ? obj.str : "";
      })
      .join(" ");

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
              // Record image presence — pdfjs gives raw pixel data, not encoded formats
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
