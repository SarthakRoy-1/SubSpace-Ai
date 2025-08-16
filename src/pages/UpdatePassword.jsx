import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import AuthCard from '../components/AuthCard.jsx'
import AuthPage from './AuthPage.jsx'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const onUpdate = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setMsg('Password updated! You can close this tab and sign in.')
  }

  return (
    <AuthPage>
      <AuthCard title="Set a new password">
        {msg && <div className="text-emerald-300 text-sm">{msg}</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <form onSubmit={onUpdate} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="w-full rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-blue-400"
              placeholder="Minimum 6 characters"
              required minLength={6}
            />
          </div>
          <button type="submit" className="w-full rounded-md bg-blue-500 hover:bg-blue-600 py-2.5 font-medium">
            Update password
          </button>
        </form>
      </AuthCard>
    </AuthPage>
  )
}
