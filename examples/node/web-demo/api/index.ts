/**
 * Vercel serverless function: Upload & index files.
 * Returns serialized IndexData so the client can store it in IndexedDB.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";
import { extname } from "node:path";
import { TreeDex, OpenAICompatibleLLM } from "treedex";

export const config = { api: { bodyParser: false } };

function makeLLM() {
  return new OpenAICompatibleLLM({
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY ?? "",
    maxTokens: 4096,
    temperature: 0.0,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }

  const llm = makeLLM();

  try {
    const form = formidable({ uploadDir: "/tmp", keepExtensions: true, maxFiles: 20 });
    const [_fields, files] = await form.parse(req);

    const uploadedFiles = files.files;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const results: Array<{
      id: string;
      fileName: string;
      stats: ReturnType<TreeDex["stats"]>;
      indexData: unknown;
    }> = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const originalName = file.originalFilename || `file-${i}`;
      const ext = extname(originalName).toLowerCase();

      // Rename if needed
      let filePath = file.filepath;
      if (!filePath.endsWith(ext)) {
        const { rename } = await import("node:fs/promises");
        const newPath = filePath + ext;
        await rename(filePath, newPath);
        filePath = newPath;
      }

      const index = await TreeDex.fromFile(filePath, llm);
      await unlink(filePath).catch(() => {});

      const stats = index.stats();
      const id = `v-${Date.now()}-${i}`;

      // Serialize index for client storage
      const indexData = { version: "1.0", framework: "TreeDex", tree: index.tree, pages: index.pages };

      results.push({ id, fileName: originalName, stats, indexData });
    }

    res.json({ success: true, documents: results });
  } catch (err) {
    console.error("Index error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
