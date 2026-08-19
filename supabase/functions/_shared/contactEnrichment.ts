export type ContactEnrichment = {
  name?: string
  email?: string
  phone?: string
  home_address?: string
  work_address?: string
  store_address?: string
  company_name?: string
}

const clean = (value: string) => value.trim().replace(/[.,;]+$/, '').replace(/\s+/g, ' ').slice(0, 300)

const asksIdentity = (text: string) => /\b(com\s+quem\s+(?:eu\s+)?falo|quem\s+(?:está|esta|tá|ta)\s+falando|qual\s+(?:é|e)\s+(?:o\s+)?seu\s+nome|quem\s+(?:é|e)\s+você)\b/i.test(text)
const bareName = (text: string) => {
  const value = clean(text)
  if(/\b(opa|oi|ol[aá]|mandei|falei|escrevi|digitei|errad[oa]|desculpa|corrigindo|verdade)\b/i.test(value))return null
  return /^[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3}$/u.test(value) && value.length >= 2 ? value : null
}

export function extractContactEnrichment(text: string, previousOutboundText = '', previousInboundText = ''): ContactEnrichment {
  const result: ContactEnrichment = {}
  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]
  if (email) result.email = email.toLowerCase()

  const patterns: Array<[keyof ContactEnrichment, RegExp]> = [
    ['home_address', /(?:meu|o)\s+endere[cç]o\s+(?:de\s+)?casa\s*(?:é|e|:|fica\s+(?:na|no))\s+(.+)/i],
    ['store_address', /(?:endere[cç]o\s+(?:(?:da|de)\s+)?minha\s+loja|endere[cç]o\s+da\s+loja|minha\s+loja\s+fica)\s*(?:é|e|:|na|no)?\s+(.+)/i],
    ['work_address', /(?:endere[cç]o\s+(?:do|de)\s+(?:meu\s+)?trabalho|meu\s+trabalho\s+fica)\s*(?:é|e|:|na|no)?\s+(.+)/i],
    ['company_name', /(?:minha\s+(?:empresa|loja)\s+(?:se\s+chama|é)|nome\s+da\s+(?:empresa|loja)\s*(?:é|:))\s+([\p{L}\d][\p{L}\d\s&'-]{1,100}?)(?=\s+e\s+(?:meu|minha)|[,.\n]|$)/iu],
    ['name', /(?:meu\s+nome\s+(?:é|e)|me\s+chamo)\s+([\p{L}][\p{L}\s'-]{1,80}?)(?=\s+e\s+(?:meu|minha)|[,.\n]|$)/iu],
    ['phone', /(?:meu\s+(?:telefone|celular|whatsapp|zap)\s*(?:é|e|:))\s*(\+?[\d\s().-]{8,25})/i],
  ]
  for (const [key, pattern] of patterns) {
    const value = text.match(pattern)?.[1]
    if (value) result[key] = key === 'phone' ? value.replace(/\D/g, '').slice(0, 20) : clean(value)
  }
  const correctingName=/\b(mandei|falei|escrevi|digitei)\s+(?:o\s+nome\s+)?errad[oa]\b|\bcorrigindo\b|\bna\s+verdade\b/i.test(previousInboundText)
  if (!result.name && (asksIdentity(previousOutboundText)||correctingName)) {
    const answer = bareName(text.replace(/^(?:oi|opa)?[,]?\s*(?:(?:na\s+verdade|corrigindo)[,:]?\s*)?(?:(?:aqui\s+)?(?:é|e)\s+|sou\s+(?:o|a)?\s*)?/i, ''))
    if (answer) result.name = answer
  }
  return result
}
