// netlify/functions/ai-chat.js
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // ok since same-origin on Netlify, helpful locally
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
    if (!HF_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'HF_API_KEY not set in environment' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = body.system || 'You are a concise, helpful AI assistant.';
    const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `${system}\n\n${history}\nASSISTANT:`;

    const resp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 256, temperature: 0.7, top_p: 0.9, return_full_text: false },
        options: { wait_for_model: true }
      })
    });

    const respText = await resp.text();      // always read text first
    if (!resp.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `HF error ${resp.status}`, details: respText.slice(0, 500) })
      };
    }

    // HF sometimes returns array, sometimes object
    let data = null;
    try { data = JSON.parse(respText); } catch { /* keep text fallback */ }

    let reply = '';
    if (Array.isArray(data)) reply = data[0]?.generated_text || data[0]?.text || '';
    else if (data) reply = data.generated_text || data.text || '';
    else reply = (respText || '').trim();

    reply = (reply || "I'm here! (Empty model response.)").trim();
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};
