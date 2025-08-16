import AnimatedBackground from '../components/AnimatedBackground'

export default function AuthPage({ children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <AnimatedBackground />
      {children}
    </div>
  )
}
