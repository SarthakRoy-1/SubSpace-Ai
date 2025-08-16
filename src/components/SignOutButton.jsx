import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function SignOutButton({ className='' }) {
  const navigate = useNavigate()
  const onClick = async () => {
    await supabase.auth.signOut()
    navigate('/signin')
  }
  return <button onClick={onClick} className={className}>Sign out</button>
}
