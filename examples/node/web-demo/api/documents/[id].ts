/**
 * Vercel serverless function: Delete document stub.
 * On Vercel, the client manages deletion locally via IndexedDB.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ success: true });
}
