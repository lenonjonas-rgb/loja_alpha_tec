import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Customer = { id?: string; name: string; document: string; email: string; phone: string; cep: string; address: string; number: string; complement: string; city: string }
type CustomerContextValue = { customer: Customer | null; loading: boolean; requestCode: (email: string, profile?: Customer) => Promise<string | null>; verifyCode: (email: string, token: string, profile?: Customer) => Promise<string | null>; signOut: () => Promise<void> }
const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    if (!supabase) {
      setCustomer(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session) {
        setCustomer(null)
        setLoading(false)
        return
      }
      const response = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (response.ok) {
        setCustomer(await response.json())
      } else if (response.status === 404) {
        const profile = session.user?.user_metadata?.profile as Customer | undefined
        const googleProfile: Customer = profile || {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Cliente',
          document: '',
          email: session.user.email || '',
          phone: '',
          cep: '',
          address: '',
          number: '',
          complement: '',
          city: ''
        }
        const profileResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(googleProfile)
        })
        if (profileResponse.ok) setCustomer(await profileResponse.json())
      }
    } catch (e) {
      console.error('Erro ao carregar perfil:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadProfile()
    })
    return () => {
      data?.subscription?.unsubscribe()
    }
  }, [])

  async function requestCode(email: string, profile?: Customer) {
    if (!supabase) return 'Supabase não está configurado. Configure as variáveis do Supabase.'
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return 'Informe um e-mail válido.'
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { data: profile ? { profile } : undefined, shouldCreateUser: true }
      })
      if (!error) return null
      if (/rate limit|too many/i.test(error.message)) return 'Muitas tentativas. Aguarde alguns minutos antes de solicitar outro código.'
      if (/smtp|email/i.test(error.message)) return 'O Supabase não conseguiu enviar o e-mail. Verifique o SMTP e o template de autenticação.'
      return error.message
    } catch {
      return 'Não foi possível solicitar o código agora. Verifique sua conexão e tente novamente.'
    }
  }

  async function verifyCode(email: string, token: string, profile?: Customer) {
    if (!supabase) return 'Supabase não está configurado.'
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error || !data.session || !data.user) return error?.message || 'Código inválido ou expirado.'
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify(profile || data.user.user_metadata?.profile || { name: data.user.email?.split('@')[0] || 'Cliente', email })
      })
      if (!response.ok) return 'Código confirmado, mas não foi possível salvar o perfil.'
      setCustomer(await response.json())
      return null
    } catch {
      return 'Não foi possível verificar o código. Tente novamente.'
    }
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setCustomer(null)
  }

  return (
    <CustomerContext.Provider value={{ customer, loading, requestCode, verifyCode, signOut }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer() { const context = useContext(CustomerContext); if (!context) throw new Error('useCustomer deve ser usado dentro de CustomerProvider'); return context }
