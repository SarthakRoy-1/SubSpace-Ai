import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import UpdatePassword from './pages/UpdatePassword.jsx'
import Chat from './pages/Chat.jsx'
import AnimatedBackground from './components/AnimatedBackground.jsx'

export default function App() {
  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<div className="p-6">404 Not Found</div>} />
      </Routes>
    </div>
  )
}
