import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import AuthCard from '../components/AuthCard.jsx'
import AuthPage from './AuthPage.jsx'

export default function SignUp() {
  const [email, setEmail] = useState('') // Explicitly empty
  const [password, setPassword] = useState('') // Explicitly empty
  const [name, setName] = useState('') // Explicitly empty
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/chat')
    })
  }, [navigate])

  const onSignUp = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } }
    })
    setLoading(false)
    if (error) { setError(error.message || 'Something went wrong'); return }
    if (data?.user?.identities?.length === 0) { setInfo('Account already exists. Try signing in.'); return }
    setInfo('Check your email to verify your account, then sign in.')
  }

  return (
    <AuthPage>
      <AuthCard
        title="Create your account"
        footer={<span>Already have an account? <Link className="underline" to="/signin">Sign in</Link></span>}
      >
        {info && <div className="text-emerald-300 text-sm mb-2">{info}</div>}
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <form onSubmit={onSignUp} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm">Full name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
              placeholder="Enter your full name"
              autoComplete="off"
              required 
            />
          </div>
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
              placeholder="Create a secure password"
              autoComplete="new-password"
              required 
              minLength={6} 
            />
          </div>
          <button 
            disabled={loading} 
            type="submit"
            className="w-full rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-60 py-2.5 font-medium"
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
      </AuthCard>
    </AuthPage>
  )
}