import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const migrationsDir = resolve(root, 'supabase', 'migrations')
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const sql = migrations.map((name) => readFileSync(resolve(migrationsDir, name), 'utf8')).join('\n')

function publicTables(source: string) {
  return [...source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)].map((m) => m[1])
}

describe('contrato mínimo de segurança do banco', () => {
  it('mantém RLS habilitado em todas as tabelas públicas criadas pelas migrations', () => {
    for (const table of publicTables(sql)) {
      expect(sql.toLowerCase()).toContain(`alter table public.${table.toLowerCase()} enable row level security`)
    }
  })

  it('fixa search_path em funções SECURITY DEFINER', () => {
    const definitions = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+[\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi)].map((m) => m[0])
    const privileged = definitions.filter((definition) => /security\s+definer/i.test(definition))
    expect(privileged.length).toBeGreaterThan(0)
    for (const definition of privileged) expect(definition).toMatch(/set\s+search_path\s*=\s*public/i)
  })

  it('não expõe chaves administrativas no frontend', () => {
    const srcDir = resolve(root, 'src')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, name.name)
        if (name.isDirectory()) walk(path)
        else if (
          /\.(ts|tsx|js|jsx)$/.test(name.name) &&
          !/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name.name)
        ) files.push(path)
      }
    }
    walk(srcDir)
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(source).not.toMatch(/SUPABASE_(SERVICE_ROLE|SECRET)_KEY/)
    expect(source).not.toContain(['META', 'APP', 'SECRET'].join('_'))
  })

  it('concede ao gateway somente as operações de banco necessárias', () => {
    const normalized = sql.toLowerCase().replace(/\s+/g, ' ')
    expect(normalized).toContain('grant select on table public.company_members to service_role')
    expect(normalized).toContain('grant select on table public.companies to service_role')
    expect(normalized).toContain('on table public.pilot_whatsapp_sessions to service_role')
    expect(normalized).toContain('on table public.pilot_whatsapp_auth to service_role')
    expect(normalized).not.toContain('grant all on schema public to service_role')

    expect(normalized).toContain('grant select, insert, update on table public.analysis_runs to service_role')
    expect(normalized).toContain('grant insert on table public.ai_suggestions to service_role')
    expect(normalized).toContain('grant update on table public.ai_suggestions to authenticated')
    expect(normalized).toContain('grant select on table public.analysis_feedback to service_role')
    expect(normalized).toContain('grant select, insert, update on table public.appointments to service_role')
  })
})
