export default function AuthCard({ title, children, footer }) {
  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="glass rounded-2xl p-6 sm:p-8 mt-24 shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-6">{title}</h1>
        <div className="space-y-4">{children}</div>
      </div>
      {footer ? <div className="text-center text-sm text-white/70 mt-3">{footer}</div> : null}
    </div>
  )
}
