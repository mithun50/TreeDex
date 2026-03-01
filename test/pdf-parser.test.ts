import { describe, it, expect } from "vitest";
import { countTokens, pagesToTaggedText, groupPages } from "../src/pdf-parser.js";
import type { Page } from "../src/types.js";

function makePages(n: number = 10, tokensEach: number = 100): Page[] {
  return Array.from({ length: n }, (_, i) => ({
    page_num: i,
    text: `Page ${i} text.`,
    token_count: tokensEach,
  }));
}

describe("countTokens", () => {
  it("should count basic tokens", () => {
    const count = countTokens("hello world");
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe("number");
  });

  it("should return 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("pagesToTaggedText", () => {
  it("should tag single page", () => {
    const pages = makePages(3);
    const result = pagesToTaggedText(pages, 1, 1);
    expect(result).toContain("<physical_index_1>");
    expect(result).toContain("</physical_index_1>");
    expect(result).toContain("Page 1 text.");
  });

  it("should tag range of pages", () => {
    const pages = makePages(5);
    const result = pagesToTaggedText(pages, 1, 3);
    expect(result).toContain("<physical_index_1>");
    expect(result).toContain("<physical_index_2>");
    expect(result).toContain("<physical_index_3>");
    expect(result).not.toContain("<physical_index_0>");
    expect(result).not.toContain("<physical_index_4>");
  });
});

describe("groupPages", () => {
  it("should create single group when under budget", () => {
    const pages = makePages(5, 100);
    const groups = groupPages(pages, 1000);
    expect(groups.length).toBe(1);
  });

  it("should create multiple groups when over budget", () => {
    const pages = makePages(10, 100);
    const groups = groupPages(pages, 300, 1);
    expect(groups.length).toBeGreaterThan(1);
  });

  it("should have overlapping pages between groups", () => {
    const pages = makePages(10, 100);
    const groups = groupPages(pages, 300, 1);

    for (let i = 0; i < groups.length - 1; i++) {
      const currentPages = new Set(
        groups[i].match(/physical_index_(\d+)/g)?.map((m) =>
          m.replace("physical_index_", ""),
        ) ?? [],
      );
      const nextPages = new Set(
        groups[i + 1].match(/physical_index_(\d+)/g)?.map((m) =>
          m.replace("physical_index_", ""),
        ) ?? [],
      );
      const overlap = [...currentPages].filter((p) => nextPages.has(p));
      expect(overlap.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should not infinite loop on huge page", () => {
    const pages: Page[] = [
      { page_num: 0, text: "huge", token_count: 50000 },
    ];
    const groups = groupPages(pages, 1000);
    expect(groups.length).toBe(1);
  });
});
