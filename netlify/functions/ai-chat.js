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
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) 
    };
  }

  try {
    // Environment variables
    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL = process.env.HF_MODEL || 'microsoft/DialoGPT-medium';

    // Parse request
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = body.system || 'You are a helpful AI assistant.';

    // Basic validation
    if (!HF_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'API key not configured',
          reply: "I'm not properly configured yet. Please set up the HF_API_KEY environment variable in Netlify."
        })
      };
    }

    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "Hello! How can I help you today?"
        })
      };
    }

    // Get the last message for simple response generation
    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage.content.toLowerCase();

    // Simple rule-based responses for common queries
    const simpleResponses = {
      'hello': "Hello! How can I assist you today?",
      'hi': "Hi there! What can I help you with?",
      'how are you': "I'm doing great, thank you for asking! How can I help you?",
      'what is chatgpt': "ChatGPT is an AI language model developed by OpenAI that can have conversations and help with various tasks. I'm a similar AI assistant here to help you!",
      'can you help me': "Absolutely! I'm here to help you with questions, conversations, and various tasks. What do you need assistance with?",
      'weather': "I don't have access to real-time weather data, but I'd recommend checking a weather app or website for current conditions in your area.",
      'time': "I don't have access to real-time information, but you can check the time on your device or search online.",
      'who are you': "I'm an AI assistant created to help answer questions and have conversations. I'm here to assist you with whatever you need!",
      'thank you': "You're welcome! Is there anything else I can help you with?",
      'thanks': "You're welcome! Feel free to ask if you need anything else.",
      'goodbye': "Goodbye! Feel free to come back anytime if you have more questions.",
      'bye': "Bye! Take care, and don't hesitate to return if you need help."
    };

    // Check for simple responses first
    for (const [key, response] of Object.entries(simpleResponses)) {
      if (userInput.includes(key)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ reply: response })
        };
      }
    }

    // Try Hugging Face API for more complex responses
    try {
      const conversation = messages
        .slice(-6) // Keep last 6 messages for context
        .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
        .join('\n');
      
      const prompt = `${system}\n\n${conversation}\nAssistant:`;

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 150,
              temperature: 0.7,
              top_p: 0.9,
              do_sample: true,
              return_full_text: false,
              repetition_penalty: 1.1
            },
            options: {
              wait_for_model: true,
              use_cache: false
            }
          })
        }
      );

      if (response.ok) {
        const responseText = await response.text();
        let aiData;
        
        try {
          aiData = JSON.parse(responseText);
        } catch {
          // If not JSON, use text directly
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              reply: responseText.trim() || generateContextualResponse(userInput)
            })
          };
        }

        let reply = '';
        if (Array.isArray(aiData)) {
          reply = aiData[0]?.generated_text || '';
        } else if (aiData && typeof aiData === 'object') {
          reply = aiData.generated_text || aiData.text || '';
        }

        // Clean up the response
        reply = reply.trim();
        
        // Remove prompt echo
        if (reply.toLowerCase().includes('assistant:')) {
          const parts = reply.split(/assistant:/i);
          reply = parts[parts.length - 1].trim();
        }

        if (reply && reply.length > 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply })
          };
        }
      }
    } catch (aiError) {
      console.log('AI API error:', aiError.message);
      // Fall through to contextual response
    }

    // Fallback: Generate contextual response
    const contextualReply = generateContextualResponse(userInput);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: contextualReply })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        reply: "I'm sorry, I encountered an error. Please try again."
      })
    };
  }
};

// Helper function to generate contextual responses
function generateContextualResponse(input) {
  const lowerInput = input.toLowerCase();
  
  // Question patterns
  if (lowerInput.includes('what') || lowerInput.includes('how') || lowerInput.includes('why') || lowerInput.includes('?')) {
    const responses = [
      "That's an interesting question! Let me think about that...",
      "Based on what I understand, here's my take on that:",
      "That's a great question! From my perspective:",
      "I'd be happy to help with that. Here's what I think:",
      "Let me share my thoughts on that question:"
    ];
    return responses[Math.floor(Math.random() * responses.length)] + " " + generateTopicResponse(lowerInput);
  }

  // Problem/help patterns
  if (lowerInput.includes('problem') || lowerInput.includes('issue') || lowerInput.includes('help') || lowerInput.includes('error')) {
    return "I understand you're facing a challenge. Can you provide more details about the specific issue? I'll do my best to help you find a solution.";
  }

  // Learning/explanation patterns
  if (lowerInput.includes('learn') || lowerInput.includes('explain') || lowerInput.includes('understand')) {
    return "I'd be happy to help you learn more about that topic! Could you be more specific about what aspect you'd like me to explain?";
  }

  // Tech-related patterns
  if (lowerInput.includes('code') || lowerInput.includes('programming') || lowerInput.includes('software') || lowerInput.includes('app')) {
    return "I can help with programming and technology questions! What specific aspect of coding or software development are you working on?";
  }

  // General conversational responses
  const generalResponses = [
    "That's interesting! Could you tell me more about that?",
    "I appreciate you sharing that with me. What would you like to explore further?",
    "Thank you for that input. How can I assist you with this topic?",
    "I'm here to help! What specific information are you looking for?",
    "That's a good point. What aspect of this would you like to discuss?"
  ];
  
  return generalResponses[Math.floor(Math.random() * generalResponses.length)];
}

// Generate topic-specific responses
function generateTopicResponse(input) {
  if (input.includes('javascript') || input.includes('js')) {
    return "JavaScript is a versatile programming language used for web development, both frontend and backend.";
  }
  if (input.includes('react')) {
    return "React is a popular JavaScript library for building user interfaces, especially for web applications.";
  }
  if (input.includes('ai') || input.includes('artificial intelligence')) {
    return "AI is a fascinating field that involves creating systems that can perform tasks typically requiring human intelligence.";
  }
  if (input.includes('python')) {
    return "Python is a powerful, easy-to-learn programming language that's great for beginners and widely used in data science and AI.";
  }
  if (input.includes('web development') || input.includes('website')) {
    return "Web development involves creating websites and web applications using technologies like HTML, CSS, and JavaScript.";
  }
  
  return "I'd be happy to discuss this topic further with you!";
}