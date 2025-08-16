import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import AuthCard from '../components/AuthCard.jsx'
import AuthPage from './AuthPage.jsx'

export default function SignIn() {
  const [email, setEmail] = useState('') // Explicitly empty
  const [password, setPassword] = useState('') // Explicitly empty
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/chat')
    })
  }, [navigate])

  const onSignIn = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message || 'Invalid login credentials'); return }
    if (data?.session) navigate('/chat')
  }

  return (
    <AuthPage>
      <AuthCard
        title="Welcome back"
        footer={<span>New here? <Link className="underline" to="/signup">Create an account</Link></span>}
      >
        <form onSubmit={onSignIn} className="space-y-4">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <div className="space-y-2">
            <label className="block text-sm">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
              placeholder="you@example.com" 
              autoComplete="off"
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
              placeholder="Enter your password"
              autoComplete="new-password"
              required 
            />
            <div className="text-right">
              <Link className="text-xs text-white/70 underline" to="/reset">Forgot password?</Link>
            </div>
          </div>
          <button 
            disabled={loading} 
            type="submit"
            className="w-full rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-60 py-2.5 font-medium"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </AuthCard>
    </AuthPage>
  )
}