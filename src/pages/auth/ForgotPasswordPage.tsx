import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { errorMessage } from '../../utils/errorMessage'

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await sendPasswordReset(email); setSent(true) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="auth-card"><span className="eyebrow">RECUPERAÇÃO</span><h1>Redefinir senha</h1>{sent ? <><p>Se existir uma conta com <strong>{email}</strong>, você receberá as instruções de redefinição.</p><Link className="secondary-link-button" to="/auth/login">Voltar para entrar</Link></> : <><p>Informe seu e-mail para receber o link de redefinição.</p><form onSubmit={submit} className="form-stack"><label><span>E-mail</span><input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button wide" disabled={busy}>{busy ? 'Enviando...' : 'Enviar link'}</button></form><div className="auth-links single"><Link to="/auth/login">Voltar para entrar</Link></div></>}</div>
}
