import { extractContactEnrichment } from './contactEnrichment.ts'

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

Deno.test('extracts explicit home, store and work addresses', () => {
  assertEquals(extractContactEnrichment('Meu endereço de casa é Rua das Flores, 25'), { home_address: 'Rua das Flores, 25' })
  assertEquals(extractContactEnrichment('endereço da minha loja: Av Brasil 100'), { store_address: 'Av Brasil 100' })
  assertEquals(extractContactEnrichment('meu trabalho fica na Rua A 9'), { work_address: 'Rua A 9' })
})

Deno.test('extracts explicitly shared profile data', () => {
  assertEquals(extractContactEnrichment('Meu nome é Ana e meu email ana@example.com'), { email: 'ana@example.com', name: 'Ana' })
})

Deno.test('does not infer an address from an unrelated phrase', () => {
  assertEquals(extractContactEnrichment('vamos nos encontrar perto da praça'), {})
})

Deno.test('accepts a bare name only after the business asks who is speaking', () => {
  assertEquals(extractContactEnrichment('Uelisson', 'Com quem eu falo mesmo?'), { name: 'Uelisson' })
  assertEquals(extractContactEnrichment('A visita é para Maria', 'Pode confirmar o horário?'), {})
})

Deno.test('isolates a corrected name without storing the rest of the phrase', () => {
  assertEquals(extractContactEnrichment('e Uelisson barros', '', 'opa mandei errado'), { name: 'Uelisson barros' })
  assertEquals(extractContactEnrichment('na verdade é Carlos Silva', '', 'mandei o nome errado'), { name: 'Carlos Silva' })
  assertEquals(extractContactEnrichment('opa mandei errado', 'Com quem eu falo?'), {})
})

Deno.test('extracts several isolated facts from one long message', () => {
  assertEquals(extractContactEnrichment('Olá, meu nome é João da Silva e preciso de ajuda. Meu e-mail é joao@email.com e meu endereço de casa é Rua das Flores, 25; obrigado'), { email: 'joao@email.com', home_address: 'Rua das Flores, 25', name: 'João da Silva' })
})
