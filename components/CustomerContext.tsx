import { createContext, useContext, useEffect, useState } from 'react'

export type Customer = { name: string; document: string; email: string; phone: string; cep: string; address: string; number: string; city: string; password: string }
type CustomerContextValue = { customer: Customer | null; signIn: (email: string, password: string) => boolean; register: (customer: Customer) => boolean; signOut: () => void }
const CustomerContext = createContext<CustomerContextValue | null>(null)
const accountKey = 'alpha-tec-customer-account'
const sessionKey = 'alpha-tec-customer-session'

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  useEffect(() => { const session = localStorage.getItem(sessionKey); const account = localStorage.getItem(accountKey); if (session && account) setCustomer(JSON.parse(account)) }, [])
  function signIn(email: string, password: string) { const account = JSON.parse(localStorage.getItem(accountKey) || 'null') as Customer | null; if (!account || account.email !== email || account.password !== password) return false; localStorage.setItem(sessionKey, 'active'); setCustomer(account); return true }
  function register(newCustomer: Customer) { localStorage.setItem(accountKey, JSON.stringify(newCustomer)); localStorage.setItem(sessionKey, 'active'); setCustomer(newCustomer); return true }
  function signOut() { localStorage.removeItem(sessionKey); setCustomer(null) }
  return <CustomerContext.Provider value={{ customer, signIn, register, signOut }}>{children}</CustomerContext.Provider>
}

export function useCustomer() { const context = useContext(CustomerContext); if (!context) throw new Error('useCustomer deve ser usado dentro de CustomerProvider'); return context }
