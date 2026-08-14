import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand"><div className="brand-mark large">S</div><div><strong>Secretária IA</strong><span>Sua empresa organizada a partir das conversas.</span></div></div>
        <Outlet />
      </section>
      <aside className="auth-aside">
        <span className="eyebrow light">MODO OBSERVAÇÃO</span>
        <h2>Você continua atendendo. A Secretária cuida do que não pode ser esquecido.</h2>
        <p>Na V1, ela acompanha somente novas mensagens em texto depois da ativação, organiza pendências e sempre permite consultar o contexto original.</p>
        <div className="auth-feature-grid">
          <div><strong>Privacidade clara</strong><span>Sem varrer histórico antigo.</span></div>
          <div><strong>Controle humano</strong><span>A IA sugere, você decide.</span></div>
          <div><strong>Contexto verificável</strong><span>Todo alerta pode apontar para a origem.</span></div>
        </div>
      </aside>
    </main>
  )
}
