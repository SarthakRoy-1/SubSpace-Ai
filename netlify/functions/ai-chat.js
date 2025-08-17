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
    const MODEL = process.env.AI_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
    
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemMessage = body.system || 'You are SubSpace AI, an intelligent and knowledgeable assistant. Always provide specific, detailed, and accurate answers to every question. Never give generic responses like "I need more information" or "Could you be more specific". If asked about any topic, provide comprehensive information with examples, explanations, and practical details. Be direct, informative, and helpful in every response.';

    if (!OPENROUTER_API_KEY) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "I need an OpenRouter API key to provide answers. Please set up the OPENROUTER_API_KEY in environment variables. The current model is set to use the free Llama 3.2 model which requires no payment, just the API key for access."
        })
      };
    }

    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "Hello! I'm SubSpace AI, powered by Llama 3.2. I can help you with a wide range of topics including technology, science, programming, general knowledge, creative writing, problem-solving, and much more. Ask me anything and I'll provide detailed, specific answers!"
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
        temperature: 0.8,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
      // Handle specific error codes
      let errorMessage = '';
      if (response.status === 402) {
        errorMessage = 'OpenRouter API: Insufficient credits or billing issue. Please check your OpenRouter account balance.';
      } else if (response.status === 401) {
        errorMessage = 'OpenRouter API: Invalid API key. Please check your OPENROUTER_API_KEY environment variable.';
      } else if (response.status === 429) {
        errorMessage = 'OpenRouter API: Rate limit exceeded. Please wait a moment before trying again.';
      } else if (response.status === 400) {
        errorMessage = 'OpenRouter API: Bad request. The model might not support this request format.';
      } else {
        errorMessage = `OpenRouter API error (${response.status}). Please try again later.`;
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: errorMessage + ' Please try again or contact support if this persists.'
        })
      };
    }

    const data = await response.json();
    console.log('OpenRouter response received');

    let reply = data?.choices?.[0]?.message?.content || '';
    
    // Clean up the response to ensure it's specific and helpful
    if (reply) {
      // Remove generic phrases that might appear
      reply = reply.replace(/^(I'd be happy to help|Let me help you|I understand you're asking|That's a great question)[.!]?\s*/i, '');
      reply = reply.replace(/Please let me know if you'd like more information[.!]?\s*$/i, '');
      reply = reply.replace(/Feel free to ask if you have more questions[.!]?\s*$/i, '');
      reply = reply.trim();
    }
    
    if (!reply || reply.length < 10) {
      reply = 'I apologize, but I was unable to generate a proper response to your question. This might be due to the model being overloaded. Please try rephrasing your question or ask something else.';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: reply })
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