// functions/ai-chat.js (note: functions/ instead of netlify/functions/)
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event, context) => {
  console.log('Function called:', event.httpMethod, event.path);
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ 
        error: 'Method not allowed. Use POST.',
        method: event.httpMethod,
        path: event.path
      }) 
    };
  }

  // Simple test response first
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      reply: "Hello! I'm working now. Your function is deployed correctly!",
      timestamp: new Date().toISOString(),
      test: true
    })
  };
};