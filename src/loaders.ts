/**
 * Document loaders for multiple file formats.
 *
 * Each loader returns a list of objects: [{page_num, text, token_count}]
 * matching the format used by pdf-parser extractPages().
 */

import { countTokens } from "./pdf-parser.js";
import type { Page } from "./types.js";

/** Split plain text into synthetic pages by character count. */
export function textToPages(
  text: string,
  charsPerPage: number = 3000,
): Page[] {
  const pages: Page[] = [];
  for (let i = 0; i < text.length; i += charsPerPage) {
    const chunk = text.slice(i, i + charsPerPage);
    pages.push({
      page_num: pages.length,
      text: chunk,
      token_count: countTokens(chunk),
    });
  }
  return pages;
}

/** Load PDF files using pdfjs-dist. */
export class PDFLoader {
  async load(path: string): Promise<Page[]> {
    const { extractPages } = await import("./pdf-parser.js");
    return extractPages(path);
  }
}

/** Load plain text or markdown files. */
export class TextLoader {
  readonly charsPerPage: number;

  constructor(charsPerPage: number = 3000) {
    this.charsPerPage = charsPerPage;
  }

  async load(path: string): Promise<Page[]> {
    const fs = await import("node:fs/promises");
    const text = await fs.readFile(path, "utf-8");
    return textToPages(text, this.charsPerPage);
  }
}

/** Load HTML files, stripping tags to plain text. */
export class HTMLLoader {
  readonly charsPerPage: number;

  constructor(charsPerPage: number = 3000) {
    this.charsPerPage = charsPerPage;
  }

  async load(path: string): Promise<Page[]> {
    const fs = await import("node:fs/promises");
    const html = await fs.readFile(path, "utf-8");
    const text = await this.stripHtml(html);
    return textToPages(text, this.charsPerPage);
  }

  private async stripHtml(html: string): Promise<string> {
    try {
      // Try htmlparser2 if available
      // @ts-expect-error -- optional peer dependency
      const { Parser } = await import("htmlparser2");
      return new Promise((resolve) => {
        const parts: string[] = [];
        let skip = false;

        const parser = new Parser({
          onopentag(name: string) {
            if (name === "script" || name === "style") skip = true;
          },
          onclosetag(name: string) {
            if (name === "script" || name === "style") skip = false;
            if (
              ["p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"].includes(name)
            ) {
              parts.push("\n");
            }
          },
          ontext(data: string) {
            if (!skip) parts.push(data);
          },
          onend() {
            const raw = parts.join("");
            resolve(raw.replace(/\n{3,}/g, "\n\n").trim());
          },
        });

        parser.write(html);
        parser.end();
      });
    } catch {
      // Fallback: simple regex-based tag stripping
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
}

/** Load DOCX files using mammoth. */
export class DOCXLoader {
  readonly charsPerPage: number;

  constructor(charsPerPage: number = 3000) {
    this.charsPerPage = charsPerPage;
  }

  async load(path: string): Promise<Page[]> {
    const fs = await import("node:fs/promises");
    // @ts-expect-error -- optional peer dependency
    const mammoth = await import("mammoth");
    const buffer = await fs.readFile(path);
    const result = await mammoth.extractRawText({ buffer });
    return textToPages(result.value, this.charsPerPage);
  }
}

interface Loader {
  load(path: string): Promise<Page[]>;
}

const EXTENSION_MAP: Record<string, { new (): Loader }> = {
  ".pdf": PDFLoader,
  ".txt": TextLoader,
  ".md": TextLoader,
  ".html": HTMLLoader,
  ".htm": HTMLLoader,
  ".docx": DOCXLoader,
};

/** Auto-detect file format and load pages. */
export async function autoLoader(filePath: string): Promise<Page[]> {
  const { extname } = await import("node:path");
  const ext = extname(filePath).toLowerCase();
  const LoaderClass = EXTENSION_MAP[ext];
  if (!LoaderClass) {
    const supported = Object.keys(EXTENSION_MAP).join(", ");
    throw new Error(
      `Unsupported file extension '${ext}'. Supported: ${supported}`,
    );
  }
  const loader = new LoaderClass();
  return loader.load(filePath);
}
