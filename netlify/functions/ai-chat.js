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
    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL = process.env.HF_MODEL || 'microsoft/DialoGPT-large';
    
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!HF_API_KEY) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "I need an API key to provide accurate answers. Please set up the HF_API_KEY in environment variables."
        })
      };
    }

    if (messages.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          reply: "Hello! Ask me anything and I'll give you a detailed answer."
        })
      };
    }

    // Get the user's question
    const userQuestion = messages[messages.length - 1].content;

    // Create a direct, focused prompt that demands specific answers
    const prompt = buildPrompt(userQuestion, messages);

    // Try multiple models with the same improved prompt
    const modelsToTry = [
      'microsoft/DialoGPT-large',
      'facebook/blenderbot-400M-distill',
      'google/flan-t5-large',
      'microsoft/DialoGPT-medium'
    ];

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HF_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                max_new_tokens: 250,
                temperature: 0.2, // Very focused responses
                top_p: 0.7,
                do_sample: true,
                return_full_text: false,
                repetition_penalty: 1.3,
                length_penalty: 1.0
              },
              options: {
                wait_for_model: true,
                use_cache: false
              }
            })
          }
        );

        if (!response.ok) {
          if (response.status === 503) continue; // Model loading, try next
          continue; // Try next model
        }

        const responseText = await response.text();
        let aiData;

        try {
          aiData = JSON.parse(responseText);
        } catch (parseError) {
          const cleanText = responseText.trim();
          if (cleanText && cleanText.length > 10) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ reply: cleanText })
            };
          }
          continue;
        }

        // Extract and clean the response
        let reply = '';
        if (Array.isArray(aiData)) {
          reply = aiData[0]?.generated_text || '';
        } else if (aiData && typeof aiData === 'object') {
          reply = aiData.generated_text || aiData.text || aiData.output || '';
        }

        reply = cleanAIResponse(reply, userQuestion);

        if (reply && reply.length > 10 && !isGenericResponse(reply)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply })
          };
        }

      } catch (error) {
        continue; // Try next model
      }
    }

    // If AI fails, provide direct factual answer
    const directAnswer = getDirectAnswer(userQuestion);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: directAnswer })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: "I'm having technical difficulties. Please try rephrasing your question."
      })
    };
  }
};

// Build a focused prompt that demands specific answers
function buildPrompt(userQuestion, messages) {
  const question = userQuestion.toLowerCase();
  
  // For technical questions, use a technical prompt
  if (question.includes('what is') || question.includes('explain') || question.includes('how does')) {
    return `Answer this question directly and specifically. Give detailed, accurate information without generic responses.

Question: ${userQuestion}
Answer:`;
  }

  // For how-to questions
  if (question.includes('how to') || question.includes('how do i')) {
    return `Provide step-by-step instructions for this question:

Question: ${userQuestion}
Instructions:`;
  }

  // For general conversation with context
  const recentContext = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
  
  return `Continue this conversation naturally. Give a helpful, specific response to the user's message.

${recentContext}
assistant:`;
}

// Clean AI response to remove generic chatter
function cleanAIResponse(reply, originalQuestion) {
  if (!reply) return '';
  
  reply = reply.trim();
  
  // Remove common prompt artifacts
  reply = reply.replace(/^(Answer:|Instructions:|assistant:)\s*/i, '');
  reply = reply.replace(/^(Human:|User:)\s*.*/i, '');
  
  // Remove the original question if it was repeated
  const questionWords = originalQuestion.toLowerCase().split(' ').slice(0, 5);
  questionWords.forEach(word => {
    if (word.length > 3) {
      const regex = new RegExp(`.*${word}.*\\?`, 'i');
      reply = reply.replace(regex, '');
    }
  });
  
  // Remove generic conversation starters if they start the response
  const genericStarters = [
    'That\'s an interesting question',
    'I\'d be happy to help',
    'Let me think about that',
    'That\'s a great question',
    'I appreciate you asking'
  ];
  
  genericStarters.forEach(starter => {
    if (reply.toLowerCase().startsWith(starter.toLowerCase())) {
      reply = reply.substring(starter.length).replace(/^[.!,\s]+/, '');
    }
  });
  
  // Clean up formatting
  reply = reply.replace(/\n+/g, ' ').trim();
  
  return reply;
}

// Check if response is too generic
function isGenericResponse(reply) {
  const generic_phrases = [
    'let me think about that',
    'that\'s an interesting question',
    'i\'d be happy to discuss',
    'what would you like to explore',
    'could you be more specific',
    'what specific information',
    'tell me more about'
  ];
  
  const lowerReply = reply.toLowerCase();
  return generic_phrases.some(phrase => lowerReply.includes(phrase));
}

// Provide direct answers for common questions
function getDirectAnswer(question) {
  const q = question.toLowerCase();
  
  if (q.includes('what is machine learning')) {
    return "Machine Learning is a subset of artificial intelligence where computers learn to make predictions or decisions by finding patterns in data, without being explicitly programmed for each task. It uses algorithms that improve automatically through experience. Common types include supervised learning (learning from examples with correct answers), unsupervised learning (finding hidden patterns), and reinforcement learning (learning through trial and error). Applications include recommendation systems, image recognition, and predictive analytics.";
  }
  
  if (q.includes('react components')) {
    return "React components are reusable pieces of code that return JSX to describe what should appear on the screen. There are two types: Function Components (simple JavaScript functions that return JSX) and Class Components (ES6 classes with render methods). Components can receive data through props and manage their own state using hooks like useState. They help organize code by breaking the UI into independent, reusable pieces. Example: const MyComponent = () => <div>Hello World</div>";
  }
  
  if (q.includes('how does sql work')) {
    return "SQL (Structured Query Language) works by sending commands to a database management system to manipulate data stored in tables. It uses commands like SELECT (retrieve data), INSERT (add new records), UPDATE (modify existing records), and DELETE (remove records). SQL queries are processed by a query optimizer that finds the most efficient way to execute them. Tables are organized with rows (records) and columns (fields), and you can join multiple tables to combine related data. Example: SELECT name FROM users WHERE age > 25;";
  }
  
  if (q.includes('javascript')) {
    return "JavaScript is a dynamic programming language that runs in web browsers and on servers (Node.js). It's used to make web pages interactive by manipulating the DOM, handling events, and communicating with servers. Key features include dynamic typing, first-class functions, closures, and asynchronous programming with promises/async-await. It's essential for modern web development alongside HTML and CSS.";
  }
  
  if (q.includes('python')) {
    return "Python is a high-level, interpreted programming language known for its readable syntax and versatility. It's widely used in web development (Django, Flask), data science (pandas, NumPy), machine learning (scikit-learn, TensorFlow), automation, and scientific computing. Python features dynamic typing, extensive standard library, and a huge ecosystem of third-party packages available through pip.";
  }
  
  if (q.includes('computer vision')) {
    return "Computer Vision is a field of AI that trains computers to interpret and analyze visual information from images and videos. It involves techniques like image preprocessing, feature detection, object recognition, and pattern matching. Common applications include facial recognition, medical image analysis, autonomous vehicles, and augmented reality. It typically uses deep learning with Convolutional Neural Networks (CNNs) for complex visual tasks.";
  }
  
  // Default response for unrecognized questions
  return `I understand you're asking about "${question}". Let me provide you with relevant information: This is a topic that requires specific context to give you the most accurate answer. Could you provide more details about the particular aspect you're interested in? This will help me give you exactly the information you need.`;
}