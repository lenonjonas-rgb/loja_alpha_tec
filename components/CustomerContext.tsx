import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Customer = { id?: string; name: string; document: string; email: string; phone: string; cep: string; address: string; number: string; complement: string; city: string }
type CustomerContextValue = { customer: Customer | null; loading: boolean; signIn: (email: string, password: string) => Promise<string | null>; register: (customer: Customer, password: string) => Promise<string | null>; signOut: () => Promise<void> }
const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  async function loadProfile() { const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } }; if (!session) { setCustomer(null); setLoading(false); return } const response = await fetch('/api/customers', { headers: { Authorization: `Bearer ${session.access_token}` } }); if (response.ok) setCustomer(await response.json()); setLoading(false) }
  useEffect(() => { void loadProfile(); const subscription = supabase?.auth.onAuthStateChange(() => { void loadProfile() }); return () => subscription?.data.subscription.unsubscribe() }, [])
  async function signIn(email: string, password: string) { if (!supabase) return 'Supabase não está configurado.'; const { error } = await supabase.auth.signInWithPassword({ email, password }); return error?.message || null }
  async function register(newCustomer: Customer, password: string) { if (!supabase) return 'Supabase não está configurado.'; const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined; const { data, error } = await supabase.auth.signUp({ email: newCustomer.email, password, options: { emailRedirectTo } }); if (error) return error.message; if (!data.session) return 'Cadastro criado. Confirme seu e-mail para continuar.'; const response = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(newCustomer) }); if (!response.ok) return 'Conta criada, mas não foi possível salvar o perfil.'; setCustomer(await response.json()); return null }
  async function signOut() { await supabase?.auth.signOut(); setCustomer(null) }
  return <CustomerContext.Provider value={{ customer, loading, signIn, register, signOut }}>{children}</CustomerContext.Provider>
}

export function useCustomer() { const context = useContext(CustomerContext); if (!context) throw new Error('useCustomer deve ser usado dentro de CustomerProvider'); return context }
