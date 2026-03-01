/**
 * Vercel serverless function: Status stub.
 * On Vercel, the client manages its own state via IndexedDB.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ indexed: false, documents: [] });
}
