// api/ask.js — Vercel Serverless Function (Gemini 1.5 Flash)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing GEMINI_API_KEY' });

    // Safely read JSON body
    let body = req.body;
    if (!body) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
        });
      });
    }

    const { question, profile } = body || {};
    if (!question) return res.status(400).json({ error: 'Missing question' });

    const system =
      'You are a Medicare explainer. Use public Medicare info. Answer at a clear 7th-grade level. ' +
      'If plan-specific info is needed, say so. Keep answers under 180 words.';
    const userContext = profile
      ? `User info: name=${profile.full_name || ''}; PartA=${profile.part_a || ''}; PartB=${profile.part_b || ''}.`
      : 'No saved user info.';
    const prompt = `${userContext}\n\nUser question: ${question}`;

    // Call Gemini (Google Generative Language API)
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Include system behavior
        system_instruction: { role: 'system', parts: [{ text: system }] },
        contents: [
          { role: 'user', parts: [{ text: prompt }] }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ error: 'Gemini error', detail: txt });
    }

    const data = await resp.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') ||
      'No answer.';
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
