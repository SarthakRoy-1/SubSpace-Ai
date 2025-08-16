// netlify/functions/ai-chat.js
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const MODEL = process.env.AI_MODEL || 'anthropic/claude-3.5-haiku';
    
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemMessage = body.system || 'You are a helpful AI assistant. Provide accurate, detailed, and informative responses to all questions.';

    if (!OPENROUTER_API_KEY) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "I need an OpenRouter API key to provide answers. Please set up the OPENROUTER_API_KEY in environment variables."
        })
      };
    }

    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "Hello! I'm your AI assistant. Ask me anything and I'll provide detailed, accurate answers."
        })
      };
    }

    // Format messages for OpenRouter API
    const formattedMessages = [
      { role: 'system', content: systemMessage },
      ...messages.slice(-10) // Keep last 10 messages for context
    ];

    console.log('Sending request to OpenRouter with model:', MODEL);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://subspace-chat.netlify.app', // Replace with your actual domain
        'X-Title': 'SubSpace Chat'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
      // Provide a helpful fallback response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: `I'm experiencing technical difficulties right now. The AI service returned an error (${response.status}). Please try again in a moment, or rephrase your question.`
        })
      };
    }

    const data = await response.json();
    console.log('OpenRouter response received');

    const reply = data?.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a proper response. Please try asking your question again.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: reply.trim() })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: "I'm having technical difficulties processing your request. Please try again in a moment."
      })
    };
  }
};