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
