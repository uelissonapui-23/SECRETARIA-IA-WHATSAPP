import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { errorMessage } from '../../utils/errorMessage'

export function SignupPage() {
  const { user, signUp } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (user) return <Navigate to="/onboarding" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use uma senha com pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try {
      const result = await signUp({ name, phone, email, password })
      setSent(result.needsEmailConfirmation)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) return <div className="auth-card"><span className="eyebrow">CONFIRMAÇÃO</span><h1>Confira seu e-mail</h1><p>Enviamos o link de confirmação para <strong>{email}</strong>. Depois de confirmar, volte ao aplicativo para continuar a configuração.</p><Link className="secondary-link-button" to="/auth/login">Voltar para entrar</Link></div>

  return (
    <div className="auth-card">
      <span className="eyebrow">NOVA CONTA</span>
      <h1>Crie seu acesso</h1>
      <p>Depois do cadastro vamos configurar sua empresa em poucos passos.</p>
      <form onSubmit={submit} className="form-stack">
        <div className="form-grid two"><label><span>Seu nome</span><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label><label><span>Telefone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" /></label></div>
        <label><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <div className="form-grid two"><label><span>Senha</span><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label><label><span>Confirmar senha</span><input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy ? 'Criando...' : 'Criar conta'}</button>
      </form>
      <div className="auth-links single"><span>Já tem conta?</span><Link to="/auth/login">Entrar</Link></div>
    </div>
  )
}
