# Secretária IA

PWA para micro e pequenos empresários que usam o WhatsApp como canal operacional. A V1 observa novas mensagens em texto depois da ativação, organiza o que é importante e lembra o empresário, sem responder clientes e sem varrer histórico antigo.

## Estado atual

- Módulo 1: Fundação técnica, concluído.
- Módulo 2: Conta, empresa e onboarding, concluído.
- Próximo: Módulo 3, WhatsApp oficial e conexão empresarial.

O plano oficial completo está em `docs/PLANO_MESTRE.md`.

## Stack

- React + TypeScript + Vite 8
- PWA
- Supabase Auth + Postgres + RLS + Edge Functions
- GitHub Actions
- Vercel

## Requisitos

Node.js 22.12 ou superior.

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Nunca coloque segredos com prefixo `VITE_`.

## Banco local

Com Docker disponível:

```bash
npx supabase start
npx supabase db reset
```

As migrations criam a fundação e o módulo completo de identidade/empresa/onboarding.

## Desenvolvimento

```bash
npm run dev
```

## Validação obrigatória

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Supabase remoto

Secrets dos módulos de backend serão configurados somente quando necessários. Para o módulo do WhatsApp estarão, entre outros, tokens da Meta e segredos internos. Nunca usar segredo da Meta ou chave secreta do Supabase no frontend.

## GitHub e Vercel

O repositório já contém workflows e `vercel.json`. Na Vercel configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Build: `npm run build`
Output: `dist`
