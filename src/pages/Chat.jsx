// src/pages/Chat.jsx - Enhanced for OpenRouter
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

  // Enhanced AI call with better system message for comprehensive responses
  const callAI = async (history) => {
    const res = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are SubSpace AI, an intelligent and comprehensive assistant. Always provide specific, detailed, and practical answers to every question. Never respond with generic phrases like "I need more information", "Could you be more specific", or "That depends". Instead, anticipate what the user wants to know and provide thorough explanations with examples, steps, or relevant details. If a question has multiple aspects, cover all of them. Be direct, informative, and actionable in every response.',
        messages: history.slice(-8) // Keep last 8 messages for context
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('AI API Error:', res.status, errorText);
      throw new Error(`AI service error (${res.status}). Please try again.`);
    }

    const data = await res.json();
    
    if (!data?.reply) {
      throw new Error('Invalid response from AI service.');
    }
    
    return data.reply;
  };

  // Send message with better error handling
  const send = async () => {
    if (!chatId || !input.trim()) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    const tmpUserId = 'tmp_user_' + Date.now()
    const userMsg = { 
      id: tmpUserId, 
      chat_id: chatId, 
      role: 'user', 
      content: text, 
      created_at: new Date().toISOString() 
    }
    setMessages(prev => [...prev, userMsg])

    try {
      // Save user message
      const { data: insertedUser, error: e1 } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, role: 'user', content: text })
        .select('id, role, content, created_at')
        .single()
      
      if (e1) {
        console.error('Database error saving user message:', e1)
        throw new Error('Failed to save message. Please try again.')
      }

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
      const botMsg = { 
        id: tmpBotId, 
        chat_id: chatId, 
        role: 'assistant', 
        content: reply, 
        created_at: new Date().toISOString() 
      }
      setMessages(prev => [...prev, botMsg])

      // Save AI message
      const { data: insertedBot, error: e2 } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, role: 'assistant', content: reply })
        .select('id, role, content, created_at')
        .single()
      
      if (e2) {
        console.error('Database error saving AI message:', e2)
        // Keep the message in UI even if DB save fails
        return
      }

      setMessages(prev => prev.map(m => (m.id === tmpBotId ? insertedBot : m)))
      
    } catch (err) {
      console.error('send error:', err)
      // Remove temp messages and show error
      setMessages(prev => prev.filter(m => !String(m.id).startsWith('tmp_')))
      
      // Add error message from AI
      const errorMsg = { 
        id: 'error_' + Date.now(), 
        chat_id: chatId, 
        role: 'assistant', 
        content: `Sorry, I encountered an error: ${err.message}. Please try asking your question again.`, 
        created_at: new Date().toISOString() 
      }
      setMessages(prev => [...prev, errorMsg])
      
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const clear = async () => {
    if (!chatId) return
    const confirmed = window.confirm('Are you sure you want to clear all messages?')
    if (!confirmed) return
    
    await supabase.from('messages').delete().eq('chat_id', chatId)
    seenIds.current = new Set()
    setMessages([])
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink/90 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-medium text-lg">SubSpace</div>
            <div className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded">AI Chat</div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={clear} 
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-sm"
            >
              Clear Chat
            </button>
            <SignOutButton className="px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors text-sm" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-[60vh] grid place-items-center">
            <div className="text-center space-y-4">
              <div className="text-xl sm:text-2xl font-medium">
                {profileName ? `Hello ${profileName}! 👋` : 'Welcome to SubSpace! 👋'}
              </div>
              <div className="text-white/60 text-sm max-w-md">
                I'm your AI assistant powered by Llama 3.2 (completely free!). Ask me anything - from technical questions and coding help to creative writing and general knowledge. I'll provide detailed, specific answers to every question.
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button 
                  onClick={() => setInput("Explain how neural networks work")}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                >
                  Neural networks explained
                </button>
                <button 
                  onClick={() => setInput("Write a Python function to reverse a string")}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                >
                  Python coding help
                </button>
                <button 
                  onClick={() => setInput("What are the latest trends in web development?")}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                >
                  Web development trends
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[70%] ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white/10 text-white'
                } px-4 py-3 rounded-2xl ${
                  m.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.role === 'assistant' && (
                    <div className="text-xs text-white/40 mt-2 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      SubSpace AI • Llama 3.2 (Free)
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-2 text-white/60">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm">SubSpace AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="max-w-4xl mx-auto w-full px-4 pb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask me anything... (Press Shift+Enter for new line)"
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 ring-blue-400 resize-none min-h-[48px] max-h-32"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '48px',
                maxHeight: '128px'
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={loading || !chatId || !input.trim()}
            className="px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? '⏳' : '🚀'}
          </button>
        </div>
        <div className="text-xs text-white/40 mt-2 text-center">
          SubSpace AI powered by Llama 3.2 (Free Model) • Can make mistakes. Verify important information.
        </div>
      </div>
    </div>
  )
}