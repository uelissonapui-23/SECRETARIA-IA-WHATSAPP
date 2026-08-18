export type ParsedChatMessage = {
  author: string
  body: string
  timestamp: string | null
}

const LINE_PATTERNS = [
  /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:-|–)\s*([^:]+):\s?(.*)$/,
  /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s+([^:]+):\s?(.*)$/,
]

function toIso(day: string, month: string, year: string, hour: string, minute: string, second = '0') {
  const numericYear = Number(year) < 100 ? 2000 + Number(year) : Number(year)
  const date = new Date(numericYear, Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function parseWhatsAppExport(text: string): ParsedChatMessage[] {
  const result: ParsedChatMessage[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue

    let matched: RegExpMatchArray | null = null
    for (const pattern of LINE_PATTERNS) {
      matched = line.match(pattern)
      if (matched) break
    }

    if (matched) {
      const [, day, month, year, hour, minute, second, authorRaw, bodyRaw] = matched
      const author = authorRaw.trim()
      const body = bodyRaw.trim()
      if (!author || !body) continue
      result.push({ author, body, timestamp: toIso(day, month, year, hour, minute, second) })
      continue
    }

    // Mensagens exportadas podem ocupar várias linhas. Somente anexamos uma
    // continuação quando já existe uma mensagem válida antes dela.
    if (result.length > 0) result[result.length - 1].body += `\n${line.trim()}`
  }

  return result
}

export function chatAuthors(messages: ParsedChatMessage[]) {
  return [...new Set(messages.map((message) => message.author).filter(Boolean))]
}

export function normalizeImportedMessages(messages: ParsedChatMessage[], myAuthor: string) {
  return messages.map((message) => ({
    direction: message.author === myAuthor ? 'outbound' as const : 'inbound' as const,
    body: message.body,
    timestamp: message.timestamp,
    author: message.author,
  }))
}

export function validationContactName(messages: ParsedChatMessage[], myAuthor: string) {
  const other = chatAuthors(messages).find((author) => author !== myAuthor)
  return other ?? 'Cliente de teste'
}
