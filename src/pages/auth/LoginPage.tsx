import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { errorMessage } from '../../utils/errorMessage'

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      const target = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(target, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">ACESSO</span>
      <h1>Entre na sua conta</h1>
      <p>Use o e-mail cadastrado para acessar sua empresa.</p>
      <form onSubmit={submit} className="form-stack">
        <label><span>E-mail</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" /></label>
        <label><span>Senha</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <div className="auth-links"><Link to="/auth/esqueci-senha">Esqueci minha senha</Link><Link to="/auth/cadastro">Criar conta</Link></div>
    </div>
  )
}
