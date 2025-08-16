import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import AuthCard from '../components/AuthCard.jsx'
import AuthPage from './AuthPage.jsx'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const onReset = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password'
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <AuthPage>
      <AuthCard title="Reset password">
        {sent ? (
          <div className="text-emerald-300 text-sm">Check your email for the reset link.</div>
        ) : (
          <form onSubmit={onReset} className="space-y-4">
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="space-y-2">
              <label className="block text-sm">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
                placeholder="you@example.com"
                required
              />
            </div>
            <button type="submit" className="w-full rounded-md bg-blue-500 hover:bg-blue-600 py-2.5 font-medium">
              Send reset link
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  )
}
