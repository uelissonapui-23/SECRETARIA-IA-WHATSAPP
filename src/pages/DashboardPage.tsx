import { AttentionCard } from '../components/AttentionCard'

export function DashboardPage() {
  return (
    <section>
      <div className="page-heading"><div><span className="eyebrow">SEXTA-FEIRA, 14 DE AGOSTO</span><h1>Boa tarde 👋</h1><p>Veja somente o que precisa da sua atenção.</p></div></div>

      <div className="summary-grid">
        <div className="summary-card"><span>Hoje</span><strong>2</strong><small>compromissos</small></div>
        <div className="summary-card"><span>Atenção</span><strong>3</strong><small>sugestões novas</small></div>
        <div className="summary-card"><span>Pendências</span><strong>2</strong><small>para resolver</small></div>
      </div>

      <div className="section-heading"><div><span className="eyebrow">SECRETÁRIA</span><h2>Encontrei isto nas conversas</h2></div><span className="status-pill">Modo observação</span></div>
      <div className="cards-stack">
        <AttentionCard eyebrow="AGENDAMENTO" title="Carlos marcou para amanhã às 15h" detail="Visita técnica mencionada na conversa de hoje." confidence={0.96}/>
        <AttentionCard eyebrow="PAGAMENTO" title="Pedro informou que faria o PIX hoje" detail="Vale conferir se o pagamento foi concluído." confidence={0.92}/>
      </div>
      <p className="demo-note">Dados demonstrativos. Quando o Supabase e o WhatsApp forem conectados, esta tela passará a exibir eventos reais.</p>
    </section>
  )
}
