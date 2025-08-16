// src/components/DebugAI.jsx
import { useState } from 'react';

export default function DebugAI() {
  const [testMessage, setTestMessage] = useState('Hello, how are you?');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testAI = async () => {
    setLoading(true);
    setError('');
    setResponse('');

    try {
      const res = await fetch('/.netlify/functions/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You are a helpful AI assistant.',
          messages: [{ role: 'user', content: testMessage }]
        })
      });

      const text = await res.text();
      console.log('Raw response:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text}`);
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold">AI Function Debug Tool</h2>
      
      <div className="space-y-2">
        <label className="block text-sm">Test Message:</label>
        <input
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
          placeholder="Enter a test message"
        />
      </div>

      <button
        onClick={testAI}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-md"
      >
        {loading ? 'Testing...' : 'Test AI Function'}
      </button>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-md">
          <h3 className="font-semibold text-red-400">Error:</h3>
          <pre className="text-sm text-red-300 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {response && (
        <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-md">
          <h3 className="font-semibold text-green-400">Response:</h3>
          <pre className="text-sm text-green-300 whitespace-pre-wrap">{response}</pre>
        </div>
      )}

      <div className="text-sm text-white/70">
        <p><strong>Instructions:</strong></p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Make sure you've set up environment variables in Netlify</li>
          <li>Deploy your site to Netlify first</li>
          <li>Test this function to see detailed error messages</li>
          <li>Check browser console for additional logs</li>
        </ol>
      </div>
    </div>
  );
}