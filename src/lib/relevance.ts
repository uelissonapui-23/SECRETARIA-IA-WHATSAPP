export function isLikelyRelevantMessage(text: string) {
  const value = text.trim().toLocaleLowerCase('pt-BR')
  if (!value) return false
  const trivial = /^(bom dia|boa tarde|boa noite|obrigad[oa]|ok|okay|beleza|blz|👍|🙏)[!. ]*$/i
  if (trivial.test(value)) return false
  return /(amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|pix|pagamento|pago|orçamento|orcamento|quanto fica|pode vir|me chama|me lembra|prazo|entrega|visita|instalação|instalacao)/i.test(value)
}
