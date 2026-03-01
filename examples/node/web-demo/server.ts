/**
 * TreeDex Web Demo
 *
 * A web app that indexes multiple documents and answers questions
 * using TreeDex + Groq (fast LLM inference) with agentic RAG.
 *
 * Usage:
 *   cd examples/node/web-demo
 *   npm install
 *   GROQ_API_KEY="gsk_..." npm start
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
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";

if (!GROQ_API_KEY) {
  console.error("Set GROQ_API_KEY environment variable");
  console.error('  GROQ_API_KEY="gsk_..." npm start');
  process.exit(1);
}

// --- Groq LLM (fast inference via OpenAI-compatible endpoint) ---
const llm: BaseLLM = new OpenAICompatibleLLM({
  baseUrl: "https://api.groq.com/openai/v1",
  model: "llama-3.3-70b-versatile",
  apiKey: GROQ_API_KEY,
  maxTokens: 4096,
  temperature: 0.0,
});

// --- State: multi-document library ---
interface DocEntry {
  id: string;
  fileName: string;
  index: TreeDex;
  stats: ReturnType<TreeDex["stats"]>;
  addedAt: number;
}

const documents = new Map<string, DocEntry>();
let docCounter = 0;

function nextId(): string {
  return String(++docCounter);
}

// --- Express app ---
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// File upload
const uploadsDir = join(__dirname, "uploads");
await mkdir(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

// --- Routes ---

// Upload and index a document (supports multiple files)
app.post("/api/index", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const results: Array<{ id: string; fileName: string; stats: ReturnType<TreeDex["stats"]> }> = [];

    for (const file of files) {
      const originalName = file.originalname;
      const ext = extname(originalName).toLowerCase();
      const filePath = file.path + ext;
      await rename(file.path, filePath);

      console.log(`Indexing: ${originalName}`);
      const index = await TreeDex.fromFile(filePath, llm);
      await unlink(filePath).catch(() => {});

      const stats = index.stats();
      const id = nextId();
      documents.set(id, {
        id,
        fileName: originalName,
        index,
        stats,
        addedAt: Date.now(),
      });

      console.log(`Indexed [${id}]: ${stats.total_nodes} nodes, ${stats.total_pages} pages`);
      results.push({ id, fileName: originalName, stats });
    }

    res.json({ success: true, documents: results });
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

    const fileName = title || "Pasted Text";
    console.log(`Indexing text: ${fileName}`);

    const { textToPages } = await import("treedex");
    const pages = textToPages(text, 3000);
    const index = await TreeDex.fromPages(pages, llm, { verbose: true });

    const stats = index.stats();
    const id = nextId();
    documents.set(id, { id, fileName, index, stats, addedAt: Date.now() });

    console.log(`Indexed [${id}]: ${stats.total_nodes} nodes, ${stats.total_pages} pages`);

    res.json({
      success: true,
      documents: [{ id, fileName, stats }],
    });
  } catch (err) {
    console.error("Index error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Query — optionally target a specific document or query all
app.post("/api/query", async (req, res) => {
  try {
    if (documents.size === 0) {
      res.status(400).json({ error: "No documents indexed yet. Upload a file first." });
      return;
    }

    const { question, docId } = req.body as { question?: string; docId?: string };
    if (!question || question.trim().length === 0) {
      res.status(400).json({ error: "No question provided" });
      return;
    }

    console.log(`Query: ${question}${docId ? ` [doc ${docId}]` : " [all docs]"}`);

    // If docId specified, query that doc; otherwise query all and merge
    if (docId) {
      const doc = documents.get(docId);
      if (!doc) {
        res.status(404).json({ error: `Document ${docId} not found` });
        return;
      }

      const result = await doc.index.query(question, { agentic: true });
      res.json({
        answer: result.answer,
        context: result.context,
        nodeIds: result.nodeIds,
        pageRanges: result.pageRanges,
        pagesStr: result.pagesStr,
        reasoning: result.reasoning,
        source: doc.fileName,
      });
    } else {
      // Query all documents, collect results
      const allResults: Array<{
        docId: string;
        fileName: string;
        answer: string;
        context: string;
        nodeIds: string[];
        pagesStr: string;
        reasoning: string;
      }> = [];

      for (const [id, doc] of documents) {
        const result = await doc.index.query(question, { agentic: true });
        if (result.nodeIds.length > 0) {
          allResults.push({
            docId: id,
            fileName: doc.fileName,
            answer: result.answer,
            context: result.context,
            nodeIds: result.nodeIds,
            pagesStr: result.pagesStr,
            reasoning: result.reasoning,
          });
        }
      }

      // Combine answers if multiple docs returned results
      if (allResults.length === 0) {
        res.json({ answer: "No relevant information found in any document.", context: "", nodeIds: [], pagesStr: "no pages", reasoning: "", results: [] });
      } else if (allResults.length === 1) {
        const r = allResults[0];
        res.json({
          answer: r.answer,
          context: r.context,
          nodeIds: r.nodeIds,
          pagesStr: r.pagesStr,
          reasoning: r.reasoning,
          source: r.fileName,
          results: allResults,
        });
      } else {
        // Multiple docs — combine context and ask LLM for a unified answer
        const combinedContext = allResults
          .map(r => `[From: ${r.fileName}]\n${r.context}`)
          .join("\n\n---\n\n");

        const { answerPrompt } = await import("treedex");
        const unifiedAnswer = await llm.generate(answerPrompt(combinedContext, question));

        const sources = allResults.map(r => `${r.fileName} (${r.pagesStr})`).join(", ");

        res.json({
          answer: unifiedAnswer,
          context: combinedContext,
          nodeIds: allResults.flatMap(r => r.nodeIds),
          pagesStr: sources,
          reasoning: allResults.map(r => `[${r.fileName}] ${r.reasoning}`).join(" | "),
          results: allResults,
        });
      }
    }
  } catch (err) {
    console.error("Query error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get all indexed documents
app.get("/api/status", (_req, res) => {
  const docs = Array.from(documents.values()).map(d => ({
    id: d.id,
    fileName: d.fileName,
    stats: d.stats,
  }));
  res.json({ indexed: docs.length > 0, documents: docs });
});

// Delete a document
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  if (documents.delete(id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Document not found" });
  }
});

// Save a specific document's index
app.get("/api/save/:id", async (req, res) => {
  const doc = documents.get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const savePath = join(uploadsDir, "index.json");
  await doc.index.save(savePath);
  const data = await readFile(savePath, "utf-8");
  await unlink(savePath).catch(() => {});

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}.treedex.json"`);
  res.send(data);
});

// Load index
app.post("/api/load", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const index = await TreeDex.load(req.file.path, llm);
    const fileName = req.file.originalname.replace(".treedex.json", "");
    await unlink(req.file.path).catch(() => {});

    const stats = index.stats();
    const id = nextId();
    documents.set(id, { id, fileName, index, stats, addedAt: Date.now() });

    res.json({
      success: true,
      documents: [{ id, fileName, stats }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n  TreeDex Web Demo`);
  console.log(`  LLM: Groq (llama-3.3-70b-versatile)`);
  console.log(`  Multi-document support enabled`);
  console.log(`  URL: http://localhost:${PORT}\n`);
});
