// src/pages/Chat.jsx - Updated callAI function with better error handling
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SignOutButton from '../components/SignOutButton'

export default function Chat() {
  const [session, setSession] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [chatId, setChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState('') // For debugging
  const seenIds = useRef(new Set())
  const scrollRef = useRef(null)
  const navigate = useNavigate()

  // ----- auth session + name (unchanged)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) {
        navigate('/signin')
      } else {
        const n =
          data.session.user?.user_metadata?.full_name ||
          data.session.user?.email?.split('@')[0] ||
          'friend'
        setProfileName(n)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      if (!s) navigate('/signin')
    })
    return () => sub?.subscription?.unsubscribe()
  }, [navigate])

  // ----- ensure user has a default chat (unchanged)
  useEffect(() => {
    if (!session?.user?.id) return
    ;(async () => {
      const { data: chats, error } = await supabase
        .from('chats')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        console.error('load chats error:', error.message)
        return
      }

      let id = chats?.[0]?.id
      if (!id) {
        const { data: created, error: ie } = await supabase
          .from('chats')
          .insert({ user_id: session.user.id, title: 'My chat' })
          .select('id')
          .single()
        if (ie) {
          console.error('create chat error:', ie.message)
          return
        }
        id = created.id
      }
      setChatId(id)
    })()
  }, [session?.user?.id])

  // ----- load messages (unchanged)
  const load = async (id = chatId) => {
    if (!id) return
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('load messages error:', error.message)
      return
    }
    seenIds.current = new Set((data || []).map(m => m.id))
    setMessages(data || [])
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  useEffect(() => {
    if (!chatId) return
    load(chatId)

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new
          if (!m || seenIds.current.has(m.id)) return
          seenIds.current.add(m.id)
          setMessages(prev => [...prev, m])
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId])

  // ----- IMPROVED callAI function with multiple fallback URLs
  const callAI = async (history) => {
    const requestBody = {
      system: 'You are a concise, helpful AI assistant for the SubSpace app. Keep answers clear and friendly.',
      messages: history.map(m => ({ role: m.role, content: m.content })).slice(-12)
    };

    // Try multiple function URLs in order
    const functionUrls = [
      '/.netlify/functions/ai-chat',  // Standard Netlify functions path
      '/api/ai-chat',                 // Alternative API path
      '/functions/ai-chat'            // Alternative functions path
    ];

    let lastError = null;
    
    for (const url of functionUrls) {
      try {
        console.log(`Trying AI function at: ${url}`);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log(`Response from ${url}:`, res.status, res.statusText);

        if (res.status === 404) {
          setDebugInfo(`Function not found at ${url}`);
          continue; // Try next URL
        }

        const text = await res.text();
        console.log(`Response text from ${url}:`, text.substring(0, 200));

        let data = null;
        try { 
          data = text ? JSON.parse(text) : null; 
        } catch (parseError) {
          throw new Error(`Invalid JSON from ${url}: ${text.substring(0, 100)}`);
        }

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status} from ${url}: ${text.substring(0, 100)}`);
        }

        setDebugInfo(`✅ Function working at ${url}`);
        return data?.reply || 'Sorry, I could not generate a response.';

      } catch (error) {
        console.error(`Error with ${url}:`, error);
        lastError = error;
        setDebugInfo(`❌ Error with ${url}: ${error.message}`);
        continue; // Try next URL
      }
    }

    // If all URLs failed, provide helpful error message
    throw new Error(
      `All function URLs failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Make sure your site is deployed to Netlify with functions enabled.`
    );
  };

  // ----- send message (unchanged except for better error handling)
  const send = async () => {
    if (!chatId || !input.trim()) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    const tmpUserId = 'tmp_user_' + Date.now()
    const userMsg = { id: tmpUserId, chat_id: chatId, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    try {
      const { data: insertedUser, error: e1 } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, role: 'user', content: text })
        .select('id, role, content, created_at')
        .single()
      if (e1) throw e1

      setMessages(prev => prev.map(m => (m.id === tmpUserId ? insertedUser : m)))

      const history = [
        ...messages
          .filter(m => !String(m.id).startsWith('tmp_'))
          .map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text }
      ]
      
      const reply = await callAI(history)

      const tmpBotId = 'tmp_bot_' + Date.now()
      const botMsg = { id: tmpBotId, chat_id: chatId, role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages(prev => [...prev, botMsg])

      const { data: insertedBot, error: e2 } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, role: 'assistant', content: reply })
        .select('id, role, content, created_at')
        .single()
      if (e2) throw e2

      setMessages(prev => prev.map(m => (m.id === tmpBotId ? insertedBot : m)))
    } catch (err) {
      console.error('send error:', err)
      setMessages(prev => prev.filter(m => !String(m.id).startsWith('tmp_')))
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const clear = async () => {
    if (!chatId) return
    await supabase.from('messages').delete().eq('chat_id', chatId)
    seenIds.current = new Set()
    setMessages([])
    setDebugInfo('')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 bg-ink/70 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-medium">SubSpace</div>
          <div className="flex items-center gap-3">
            <button onClick={clear} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">Clear</button>
            <SignOutButton className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20" />
          </div>
        </div>
        {debugInfo && (
          <div className="max-w-4xl mx-auto px-4 py-2 text-xs text-white/70 border-t border-white/10">
            🔧 Debug: {debugInfo}
          </div>
        )}
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-[60vh] grid place-items-center">
            <div className="text-center">
              <div className="text-xl sm:text-2xl mb-2">
                {profileName ? `${profileName}, how can I help you?` : 'How can I help you?'}
              </div>
              <div className="text-white/60 text-sm">Start the conversation below</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(m => (
              <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={`inline-block px-3 py-2 rounded-lg ${m.role==='user' ? 'bg-blue-600' : 'bg-white/10'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 pb-6">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=> e.key==='Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null}
            placeholder="Type your message…"
            className="flex-1 rounded-md bg-white/10 px-3 py-3 outline-none focus:ring-2 ring-blue-400"
          />
          <button
            onClick={send}
            disabled={loading || !chatId}
            className="px-4 rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}