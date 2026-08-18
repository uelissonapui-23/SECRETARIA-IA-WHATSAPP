import { describe, expect, it } from 'vitest'
import { chatAuthors, normalizeImportedMessages, parseWhatsAppExport, validationContactName } from './chatImport'

describe('importação oficial de conversa exportada', () => {
  it('interpreta formato Android e preserva continuação de linha', () => {
    const parsed = parseWhatsAppExport('17/08/2026, 10:30 - Cliente: Preciso de um orçamento\npara amanhã\n17/08/2026, 10:31 - Minha Empresa: Claro!')
    expect(parsed).toHaveLength(2)
    expect(parsed[0].author).toBe('Cliente')
    expect(parsed[0].body).toContain('para amanhã')
    expect(chatAuthors(parsed)).toEqual(['Cliente', 'Minha Empresa'])
  })

  it('interpreta formato entre colchetes', () => {
    const parsed = parseWhatsAppExport('[17/08/2026, 15:20:10] Carlos: Pode marcar para sexta?')
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Carlos')
    expect(parsed[0].timestamp).toBeTruthy()
  })

  it('separa mensagens da empresa e do cliente sem alterar o texto', () => {
    const parsed = parseWhatsAppExport('17/08/2026, 10:30 - Cliente: Oi\n17/08/2026, 10:31 - Loja: Olá')
    const normalized = normalizeImportedMessages(parsed, 'Loja')
    expect(normalized.map((message) => message.direction)).toEqual(['inbound', 'outbound'])
    expect(validationContactName(parsed, 'Loja')).toBe('Cliente')
  })
})
