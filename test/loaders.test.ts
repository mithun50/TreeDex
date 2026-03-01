import { describe, it, expect } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { textToPages, TextLoader, HTMLLoader, autoLoader } from "../src/loaders.js";

const TMP_DIR = join(tmpdir(), "treedex-test-" + Date.now());

async function setup() {
  await mkdir(TMP_DIR, { recursive: true });
}

async function teardown() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

describe("textToPages", () => {
  it("should create single page for short text", () => {
    const pages = textToPages("hello world", 100);
    expect(pages.length).toBe(1);
    expect(pages[0].text).toBe("hello world");
    expect(pages[0].page_num).toBe(0);
  });

  it("should create multiple pages", () => {
    const text = "A".repeat(9000);
    const pages = textToPages(text, 3000);
    expect(pages.length).toBe(3);
    for (let i = 0; i < pages.length; i++) {
      expect(pages[i].page_num).toBe(i);
      expect(pages[i].text.length).toBe(3000);
    }
  });

  it("should include token_count", () => {
    const pages = textToPages("hello world");
    expect(pages[0].token_count).toBeGreaterThan(0);
  });
});

describe("TextLoader", () => {
  it("should load txt file", async () => {
    await setup();
    const filePath = join(TMP_DIR, "test.txt");
    await writeFile(filePath, "This is a test document with some content.");

    const loader = new TextLoader();
    const pages = await loader.load(filePath);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].text).toContain("test document");

    await teardown();
  });

  it("should respect custom page size", async () => {
    await setup();
    const filePath = join(TMP_DIR, "test2.txt");
    await writeFile(filePath, "A".repeat(100));

    const loader = new TextLoader(30);
    const pages = await loader.load(filePath);
    expect(pages.length).toBe(4); // ceil(100/30) = 4

    await teardown();
  });
});

describe("HTMLLoader", () => {
  it("should strip tags", async () => {
    await setup();
    const filePath = join(TMP_DIR, "test.html");
    await writeFile(
      filePath,
      "<html><body><p>Hello</p><p>World</p></body></html>",
    );

    const loader = new HTMLLoader();
    const pages = await loader.load(filePath);
    const text = pages[0].text;
    expect(text).toContain("Hello");
    expect(text).toContain("World");
    expect(text).not.toContain("<p>");

    await teardown();
  });

  it("should strip script tags", async () => {
    await setup();
    const filePath = join(TMP_DIR, "test2.html");
    await writeFile(
      filePath,
      "<html><script>alert('x')</script><p>Content</p></html>",
    );

    const loader = new HTMLLoader();
    const pages = await loader.load(filePath);
    expect(pages[0].text).not.toContain("alert");
    expect(pages[0].text).toContain("Content");

    await teardown();
  });
});

describe("autoLoader", () => {
  it("should auto-load txt", async () => {
    await setup();
    const filePath = join(TMP_DIR, "doc.txt");
    await writeFile(filePath, "Auto loaded text.");

    const pages = await autoLoader(filePath);
    expect(pages[0].text).toContain("Auto loaded text");

    await teardown();
  });

  it("should auto-load html", async () => {
    await setup();
    const filePath = join(TMP_DIR, "doc.html");
    await writeFile(filePath, "<p>Auto HTML</p>");

    const pages = await autoLoader(filePath);
    expect(pages[0].text).toContain("Auto HTML");

    await teardown();
  });

  it("should throw for unsupported extension", async () => {
    await setup();
    const filePath = join(TMP_DIR, "doc.xyz");
    await writeFile(filePath, "data");

    await expect(autoLoader(filePath)).rejects.toThrow(
      "Unsupported file extension",
    );

    await teardown();
  });

  it("should auto-load md", async () => {
    await setup();
    const filePath = join(TMP_DIR, "notes.md");
    await writeFile(filePath, "# Heading\n\nSome markdown text.");

    const pages = await autoLoader(filePath);
    expect(pages[0].text).toContain("markdown");

    await teardown();
  });
});
