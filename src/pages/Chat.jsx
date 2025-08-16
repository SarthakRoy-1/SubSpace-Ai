// src/pages/Chat.jsx - Updated without debug messages
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
  const seenIds = useRef(new Set())
  const scrollRef = useRef(null)
  const navigate = useNavigate()

  // Auth session + name
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

  // Ensure user has a default chat
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

  // Load messages
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

  // Simple, direct AI call
  const callAI = async (history) => {
    const res = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a helpful AI assistant. Provide direct, accurate answers.',
        messages: history.map(m => ({ role: m.role, content: m.content })).slice(-8)
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Request failed: ${errorText}`);
    }

    const data = await res.json();
    return data?.reply || 'Sorry, I could not generate a response.';
  };

  // Send message
  const send = async () => {
    if (!chatId || !input.trim()) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    const tmpUserId = 'tmp_user_' + Date.now()
    const userMsg = { id: tmpUserId, chat_id: chatId, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    try {
      // Save user message
      const { data: insertedUser, error: e1 } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, role: 'user', content: text })
        .select('id, role, content, created_at')
        .single()
      if (e1) throw e1

      setMessages(prev => prev.map(m => (m.id === tmpUserId ? insertedUser : m)))

      // Get AI response
      const history = [
        ...messages
          .filter(m => !String(m.id).startsWith('tmp_'))
          .map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text }
      ]
      
      const reply = await callAI(history)

      // Add AI message
      const tmpBotId = 'tmp_bot_' + Date.now()
      const botMsg = { id: tmpBotId, chat_id: chatId, role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages(prev => [...prev, botMsg])

      // Save AI message
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
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - No debug message */}
      <div className="sticky top-0 z-10 bg-ink/70 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-medium">SubSpace</div>
          <div className="flex items-center gap-3">
            <button onClick={clear} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">Clear</button>
            <SignOutButton className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-[60vh] grid place-items-center">
            <div className="text-center">
              <div className="text-xl sm:text-2xl mb-2">
                {profileName ? `${profileName}, how can I help you?` : 'How can I help you?'}
              </div>
              <div className="text-white/60 text-sm">Ask me anything - I'll give you detailed answers</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(m => (
              <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={`inline-block px-3 py-2 rounded-lg max-w-[80%] ${
                  m.role==='user' 
                    ? 'bg-blue-600' 
                    : 'bg-white/10'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="max-w-4xl mx-auto w-full px-4 pb-6">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=> e.key==='Enter' && !e.shiftKey ? (e.preventDefault(), send()) : null}
            placeholder="Ask me anything..."
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