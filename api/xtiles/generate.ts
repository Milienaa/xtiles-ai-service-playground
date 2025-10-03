// /api/xtiles/generate.ts (Node.js serverless function на Vercel)
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // обробимо preflight самостійно (щоб не впиратись у CORS stage-сервера)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const upstream = 'https://stage.xtiles.app/api/ai/gpt/generate-from-md';
    const r = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const text = await r.text();
    res
      .status(r.status)
      .setHeader('Content-Type', 'application/json')
      // даємо вашому фронту читати відповідь
      .setHeader('Access-Control-Allow-Origin', '*')
      .send(text);
  } catch (e: any) {
    res.status(500).json({ error: 'proxy_error', message: e?.message || 'Unknown error' });
  }
}
