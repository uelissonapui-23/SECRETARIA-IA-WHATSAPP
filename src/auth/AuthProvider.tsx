import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type SignUpInput = { name: string; email: string; password: string; phone?: string }
type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function transientAuthFailure(error:unknown){
  const value=error as {status?:number;message?:string}|null
  return Boolean(value&&([502,503,504].includes(Number(value.status))||/\b(?:502|503|504)\b|gateway|timeout|timed out|fetch failed/i.test(String(value.message??''))))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) console.error('Falha ao recuperar sessão:', error.message)
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const credentials={ email: email.trim(), password }
    let { error } = await supabase.auth.signInWithPassword(credentials)
    if(error&&transientAuthFailure(error)){
      await new Promise(resolve=>window.setTimeout(resolve,1200))
      ;({error}=await supabase.auth.signInWithPassword(credentials))
    }
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ name, email, password, phone }: SignUpInput) => {
    const redirectTo = `${window.location.origin}/auth/confirmado`
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { display_name: name.trim(), phone: phone?.trim() ?? '' },
      },
    })
    if (error) throw error
    return { needsEmailConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/nova-senha`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
  }), [session, loading, signIn, signUp, signOut, sendPasswordReset, updatePassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
