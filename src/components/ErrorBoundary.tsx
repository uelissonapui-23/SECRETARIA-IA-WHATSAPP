import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : 'Erro inesperado' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Falha inesperada da interface', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="fatal-error-page">
        <section className="fatal-error-card" role="alert">
          <div className="fatal-error-icon"><AlertTriangle size={28}/></div>
          <span className="eyebrow">ALGO NÃO SAIU COMO ESPERADO</span>
          <h1>O aplicativo encontrou um problema.</h1>
          <p>Seus dados não foram apagados. Atualize a tela. Se o problema continuar, volte ao Início.</p>
          <div className="fatal-error-actions">
            <button className="primary-button" onClick={() => window.location.reload()}><RefreshCw size={17}/>Atualizar</button>
            <a className="secondary-button" href="/"><Home size={17}/>Ir para o Início</a>
          </div>
          {import.meta.env.DEV && this.state.message && <details><summary>Detalhes técnicos</summary><pre>{this.state.message}</pre></details>}
        </section>
      </main>
    )
  }
}
