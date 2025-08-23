// api/ask.js — Vercel Serverless Function
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });

    // Safely read JSON body (works whether Vercel parsed it or not)
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
      'You are a Medicare explainer. Use public Medicare info only. Answer clearly at a 7th-grade level. ' +
      'If plan-specific info is needed, say so. Keep answers under 180 words.';
    const userContext = profile
      ? `User info: name=${profile.full_name||''}; PartA=${profile.part_a||''}; PartB=${profile.part_b||''}.`
      : 'No saved user info.';
    const prompt = `${userContext}\n\nUser question: ${question}`;

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ error: 'OpenAI error', detail: txt });
    }
    const data = await resp.json();
    const answer = data.output_text || 'Sorry — no text returned.';
    res.status(200).json({ answer });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
