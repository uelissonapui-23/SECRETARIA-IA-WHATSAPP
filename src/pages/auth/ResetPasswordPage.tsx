import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { errorMessage } from '../../utils/errorMessage'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (password.length < 8) return setError('Use uma senha com pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try { await updatePassword(password); navigate('/', { replace: true }) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="auth-card"><span className="eyebrow">NOVA SENHA</span><h1>Escolha sua nova senha</h1><p>Depois da alteração você continuará conectado.</p><form onSubmit={submit} className="form-stack"><label><span>Nova senha</span><input type="password" minLength={8} required value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" /></label><label><span>Confirmar nova senha</span><input type="password" minLength={8} required value={confirm} onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button wide" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button></form></div>
}
