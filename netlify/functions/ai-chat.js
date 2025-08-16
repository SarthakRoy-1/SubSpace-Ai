// netlify/functions/ai-chat.js
// Proxy to Hugging Face so your API key stays secret.
// Set env vars in Netlify: HF_API_KEY and HF_MODEL (e.g. Qwen/Qwen2.5-7B-Instruct)

export const config = { path: "/.netlify/functions/ai-chat" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL = process.env.HF_MODEL || "Qwen/Qwen2.5-7B-Instruct";
    if (!HF_API_KEY) return res.status(500).json({ error: "HF_API_KEY not set in environment" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const msgs = Array.isArray(body.messages) ? body.messages : [];
    const sys = body.system || "You are a concise, helpful AI assistant.";
    const history = msgs.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const prompt = `${sys}\n\n${history}\nASSISTANT:`;

    const hfResp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 256, temperature: 0.7, top_p: 0.9, return_full_text: false },
        options: { wait_for_model: true }
      })
    });

    if (!hfResp.ok) {
      const txt = await hfResp.text();
      return res.status(502).json({ error: `HF error: ${hfResp.status} ${txt}` });
    }

    let data = await hfResp.json();
    let reply = "";
    if (Array.isArray(data)) reply = (data[0] && (data[0].generated_text || data[0].text)) || "";
    else reply = data.generated_text || data.text || "";

    reply = String(reply || "").trim();
    if (!reply) reply = "I'm here! (The model returned an empty response.)";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
