export function SetupPage() {
  return <main className="setup-page"><div className="setup-card"><div className="brand-mark large">S</div><span className="eyebrow">PRIMEIRA EXECUÇÃO</span><h1>Base da Secretária IA pronta.</h1><p>Crie o arquivo <code>.env.local</code> usando <code>.env.example</code> e informe a URL e a chave publicável do projeto Supabase.</p><pre>{`VITE_SUPABASE_URL=https://...supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}</pre><p className="muted">Segredos da Meta e da IA nunca devem usar prefixo VITE_.</p></div></main>
}
