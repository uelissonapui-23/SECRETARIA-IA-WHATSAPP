import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('fechamento pré-Meta', () => {
  it('mantém PWA instalável e atualização automática', () => {
    const vite = read('vite.config.ts')
    expect(vite).toContain("registerType: 'autoUpdate'")
    expect(vite).toContain("display: 'standalone'")
    expect(vite).toContain("start_url: '/'")
    expect(vite).toContain("scope: '/'")
  })

  it('carrega módulos principais sob demanda', () => {
    const app = read('src/App.tsx')
    for (const page of ['DashboardPage','AgendaPage','WorkPage','ClientsPage','SecretaryPage','SettingsPage','WhatsAppPage','MasterPage']) {
      expect(app).toContain(`const ${page}=lazy(`)
    }
    expect(app).toContain('<Suspense')
  })

  it('protege conta comum, onboarding e conta Master', () => {
    const guard = read('src/components/AppGuard.tsx')
    expect(guard).toContain("claim_platform_master_bootstrap")
    expect(guard).toContain("get_my_platform_role")
    expect(guard).toContain("location.pathname !== '/master'")
    expect(guard).toContain("location.pathname !== '/onboarding'")
  })

  it('tem recuperação global de erro e aviso offline', () => {
    const main = read('src/main.tsx')
    const shell = read('src/components/AppShell.tsx')
    expect(main).toContain('<ErrorBoundary>')
    expect(shell).toContain("window.addEventListener('offline'")
    expect(shell).toContain('offline-banner')
  })

  it('mantém navegação adaptada para telas estreitas', () => {
    const css = read('src/styles.css')
    expect(css).toMatch(/@media\(max-width:1100px\)/)
    expect(css).toMatch(/@media\(max-width:700px\)/)
    expect(css).toMatch(/@media\(min-width:1600px\)/)
    expect(css).toContain('overflow-x:hidden')
    expect(css).toContain('.bottom-nav')
  })

  it('mantém formulários de autenticação preparados para navegador e mobile', () => {
    const login = read('src/pages/auth/LoginPage.tsx')
    const signup = read('src/pages/auth/SignupPage.tsx')
    expect(login).toContain('autoComplete="email"')
    expect(login).toContain('autoComplete="current-password"')
    expect(signup).toContain('autoComplete="new-password"')
    expect(signup).toContain('inputMode="tel"')
  })
})
