const authMap: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'User already registered': 'Já existe uma conta com este e-mail.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
}

export function errorMessage(error: unknown, fallback = 'Não foi possível concluir. Tente novamente.') {
  if (error instanceof Error) return authMap[error.message] ?? error.message ?? fallback
  return fallback
}
