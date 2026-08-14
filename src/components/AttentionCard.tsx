import { ChevronRight, MessageSquareText } from 'lucide-react'

type Props = {
  eyebrow: string
  title: string
  detail: string
  confidence?: number
}

export function AttentionCard({ eyebrow, title, detail, confidence }: Props) {
  return (
    <article className="attention-card">
      <div className="attention-main">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{detail}</p>
        {confidence ? <small>Confiança da análise: {Math.round(confidence * 100)}%</small> : null}
      </div>
      <div className="card-actions">
        <button className="primary-button">Confirmar</button>
        <button className="secondary-button"><MessageSquareText size={17}/> Ver contexto</button>
        <button className="ghost-button" aria-label="Mais detalhes"><ChevronRight size={19}/></button>
      </div>
    </article>
  )
}
