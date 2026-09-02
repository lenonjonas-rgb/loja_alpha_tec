import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Product } from '../lib/products'
import { supabase } from '../lib/supabase'
import { useCustomer } from './CustomerContext'

export type CartItem = Product & { quantity: number }
type CartContextValue = { items: CartItem[]; count: number; subtotal: number; addItem: (product: Product) => void; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void; clearCart: () => void }
const CartContext = createContext<CartContextValue | null>(null)
const storageKey = 'alpha-tec-cart'

function mergeCarts(local: CartItem[], server: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>(server.map((item) => [item.id, item]))
  for (const item of local) {
    const existing = merged.get(item.id)
    merged.set(item.id, existing ? { ...existing, quantity: (existing.quantity || 0) + (item.quantity || 0) } : item)
  }
  return Array.from(merged.values())
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { customer } = useCustomer()
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  // guarda o id do cliente já sincronizado com o servidor, para não repetir a mescla a cada render
  const syncedCustomerId = useRef<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item) => item && typeof item === 'object' && item.id))
        }
      }
    } catch (e) {
      console.error('Erro ao ler carrinho do localStorage:', e)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch (e) {
      console.error('Erro ao salvar carrinho no localStorage:', e)
    }
  }, [items, hydrated])

  // carrinho fica atrelado à conta: ao logar, busca o carrinho salvo no servidor e mescla com o que estava no dispositivo
  useEffect(() => {
    if (!hydrated || !supabase) return
    if (!customer?.id) {
      syncedCustomerId.current = null
      return
    }
    if (syncedCustomerId.current === customer.id) return
    syncedCustomerId.current = customer.id
    void (async () => {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      try {
        const response = await fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) return
        const result = await response.json()
        const serverItems: CartItem[] = Array.isArray(result.items) ? result.items : []
        setItems((current) => mergeCarts(current, serverItems))
      } catch (e) {
        console.error('Erro ao sincronizar carrinho com o servidor:', e)
      }
    })()
  }, [customer?.id, hydrated])

  // qualquer alteração no carrinho de um cliente logado é replicada ao servidor, para valer em qualquer dispositivo
  useEffect(() => {
    if (!hydrated || !supabase || !customer?.id) return
    if (syncedCustomerId.current !== customer.id) return
    const timeout = setTimeout(() => {
      void (async () => {
        const { data } = await supabase!.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        try {
          await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ items }) })
        } catch (e) {
          console.error('Erro ao salvar carrinho no servidor:', e)
        }
      })()
    }, 600)
    return () => clearTimeout(timeout)
  }, [items, customer?.id, hydrated])


  function addItem(product: Product) {
    if (!product || !product.id) return
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id)
      const price = Number(product.price || 0)
      return existing
        ? current.map((item) => (item.id === product.id ? { ...item, quantity: (item.quantity || 1) + 1 } : item))
        : [...current, { ...product, price, quantity: 1 }]
    })
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((current) =>
      quantity > 0
        ? current.map((item) => (item.id === id ? { ...item, quantity } : item))
        : current.filter((item) => item.id !== id)
    )
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  function clearCart() {
    setItems([])
  }

  const safeItems = Array.isArray(items) ? items : []
  const count = safeItems.reduce((total, item) => total + (Number(item?.quantity) || 0), 0)
  const subtotal = safeItems.reduce(
    (total, item) => total + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
    0
  )

  return (
    <CartContext.Provider
      value={{ items: safeItems, count, subtotal, addItem, updateQuantity, removeItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart deve ser usado dentro de CartProvider'); return context }
