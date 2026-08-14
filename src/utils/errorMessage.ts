const authMap: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'User already registered': 'Já existe uma conta com este e-mail.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  not_company_admin: 'Sua conta não possui permissão para alterar esta empresa.',
  company_name_required: 'Informe o nome da empresa.',
  invalid_state: 'Informe a UF com duas letras.',
  working_days_required: 'Selecione pelo menos um dia de atendimento.',
  invalid_working_day: 'Há um dia de atendimento inválido.',
  company_not_found: 'A empresa não foi encontrada. Atualize a página e tente novamente.',
}

type ErrorLike = { message?: unknown; code?: unknown; details?: unknown }

export function errorMessage(error: unknown, fallback = 'Não foi possível concluir. Tente novamente.') {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? String((error as ErrorLike).message ?? '')
      : ''

  if (!raw) return fallback

  const exact = authMap[raw]
  if (exact) return exact

  const mappedKey = Object.keys(authMap).find((key) => raw.includes(key))
  if (mappedKey) return authMap[mappedKey]

  return raw
}
