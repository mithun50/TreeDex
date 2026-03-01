/**
 * Vercel serverless function: Load a saved TreeDex index.
 * Parses the uploaded JSON and returns indexData to the client.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const form = formidable({ uploadDir: "/tmp", keepExtensions: true, maxFiles: 1 });
    const [_fields, files] = await form.parse(req);

    const uploadedFile = files.file?.[0];
    if (!uploadedFile) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const content = await readFile(uploadedFile.filepath, "utf-8");
    await unlink(uploadedFile.filepath).catch(() => {});

    const indexData = JSON.parse(content);
    const fileName = (uploadedFile.originalFilename || "index").replace(".treedex.json", "");

    // Calculate basic stats from the index data
    const totalPages = indexData.pages?.length ?? 0;
    const countNodes = (nodes: any[]): number =>
      nodes.reduce((acc: number, n: any) => acc + 1 + (n.nodes ? countNodes(n.nodes) : 0), 0);
    const totalNodes = indexData.tree ? countNodes(indexData.tree) : 0;
    const totalTokens = (indexData.pages || []).reduce((acc: number, p: any) => acc + (p.token_count || 0), 0);

    const id = `v-${Date.now()}`;
    const stats = { total_pages: totalPages, total_nodes: totalNodes, total_tokens: totalTokens, leaf_nodes: 0, root_sections: indexData.tree?.length ?? 0 };

    res.json({
      success: true,
      documents: [{ id, fileName, stats, indexData }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
