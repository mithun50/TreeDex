/**
 * Vercel serverless function: Save index stub.
 * On Vercel, the client handles save locally from IndexedDB.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(400).json({ error: "Save is handled client-side on Vercel. Use the sidebar save button." });
}
