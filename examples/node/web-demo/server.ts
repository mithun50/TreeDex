/**
 * TreeDex Web Demo
 *
 * A minimal web app that indexes documents and answers questions
 * using TreeDex + NVIDIA API (Kimi K2.5 via OpenAI-compatible endpoint).
 *
 * Usage:
 *   cd examples/node/web-demo
 *   npm install
 *   NVIDIA_API_KEY="nvapi-..." npm start
 *
 * Then open http://localhost:3000
 */

import express from "express";
import multer from "multer";
import { readFile, unlink, mkdir, rename } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { TreeDex, OpenAICompatibleLLM, type BaseLLM } from "treedex";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const PORT = Number(process.env.PORT) || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";

if (!NVIDIA_API_KEY) {
  console.error("Set NVIDIA_API_KEY environment variable");
  console.error('  NVIDIA_API_KEY="nvapi-..." npm start');
  process.exit(1);
}

// --- NVIDIA LLM (Kimi K2.5 via OpenAI-compatible endpoint) ---
const llm: BaseLLM = new OpenAICompatibleLLM({
  baseUrl: "https://integrate.api.nvidia.com/v1",
  model: "moonshotai/kimi-k2.5",
  apiKey: NVIDIA_API_KEY,
  maxTokens: 16384,
  temperature: 1.0,
});

// --- State ---
let currentIndex: TreeDex | null = null;
let currentFileName = "";

// --- Express app ---
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// File upload
const uploadsDir = join(__dirname, "uploads");
await mkdir(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

// --- Routes ---

// Upload and index a document
app.post("/api/index", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const originalName = req.file.originalname;
    const ext = extname(originalName).toLowerCase();
    // Multer strips the extension — rename so autoLoader can detect format
    const filePath = req.file.path + ext;
    await rename(req.file.path, filePath);
    currentFileName = originalName;

    console.log(`Indexing: ${originalName}`);
    currentIndex = await TreeDex.fromFile(filePath, llm);

    // Clean up uploaded file
    await unlink(filePath).catch(() => {});

    const stats = currentIndex.stats();
    console.log(`Indexed: ${stats.total_nodes} nodes, ${stats.total_pages} pages`);

    res.json({
      success: true,
      fileName: originalName,
      stats,
    });
  } catch (err) {
    console.error("Index error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Index from pasted text
app.post("/api/index-text", async (req, res) => {
  try {
    const { text, title } = req.body as { text?: string; title?: string };
    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    currentFileName = title || "Pasted Text";
    console.log(`Indexing text: ${currentFileName}`);

    // Convert text to pages manually
    const { textToPages } = await import("treedex");
    const pages = textToPages(text, 3000);

    currentIndex = await TreeDex.fromPages(pages, llm, { verbose: true });

    const stats = currentIndex.stats();
    console.log(`Indexed: ${stats.total_nodes} nodes, ${stats.total_pages} pages`);

    res.json({
      success: true,
      fileName: currentFileName,
      stats,
    });
  } catch (err) {
    console.error("Index error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Query the indexed document
app.post("/api/query", async (req, res) => {
  try {
    if (!currentIndex) {
      res.status(400).json({ error: "No document indexed yet. Upload a file first." });
      return;
    }

    const { question } = req.body as { question?: string };
    if (!question || question.trim().length === 0) {
      res.status(400).json({ error: "No question provided" });
      return;
    }

    console.log(`Query: ${question}`);
    const result = await currentIndex.query(question);

    res.json({
      context: result.context,
      nodeIds: result.nodeIds,
      pageRanges: result.pageRanges,
      pagesStr: result.pagesStr,
      reasoning: result.reasoning,
    });
  } catch (err) {
    console.error("Query error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get current index info
app.get("/api/status", (_req, res) => {
  if (!currentIndex) {
    res.json({ indexed: false });
    return;
  }
  res.json({
    indexed: true,
    fileName: currentFileName,
    stats: currentIndex.stats(),
  });
});

// Save index
app.get("/api/save", async (_req, res) => {
  if (!currentIndex) {
    res.status(400).json({ error: "No document indexed" });
    return;
  }

  const savePath = join(uploadsDir, "index.json");
  await currentIndex.save(savePath);
  const data = await readFile(savePath, "utf-8");
  await unlink(savePath).catch(() => {});

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${currentFileName}.treedex.json"`);
  res.send(data);
});

// Load index
app.post("/api/load", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    currentIndex = await TreeDex.load(req.file.path, llm);
    currentFileName = req.file.originalname.replace(".treedex.json", "");
    await unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      fileName: currentFileName,
      stats: currentIndex.stats(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n  TreeDex Web Demo`);
  console.log(`  LLM: NVIDIA Kimi K2.5`);
  console.log(`  URL: http://localhost:${PORT}\n`);
});
