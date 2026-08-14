import { Link } from 'react-router-dom'
export function ConfirmedPage() { return <div className="auth-card"><span className="eyebrow">E-MAIL CONFIRMADO</span><h1>Seu acesso está pronto</h1><p>Agora entre na sua conta para configurar a empresa e escolher o que a Secretária deve acompanhar.</p><Link className="primary-link-button" to="/auth/login">Entrar</Link></div> }
