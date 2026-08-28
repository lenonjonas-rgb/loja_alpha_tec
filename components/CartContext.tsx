import { createContext, useContext, useEffect, useState } from 'react'
import type { Product } from '../lib/products'

export type CartItem = Product & { quantity: number }
type CartContextValue = { items: CartItem[]; count: number; subtotal: number; addItem: (product: Product) => void; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void }
const CartContext = createContext<CartContextValue | null>(null)
const storageKey = 'alpha-tec-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

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
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch (e) {
      console.error('Erro ao salvar carrinho no localStorage:', e)
    }
  }, [items])

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

  const safeItems = Array.isArray(items) ? items : []
  const count = safeItems.reduce((total, item) => total + (Number(item?.quantity) || 0), 0)
  const subtotal = safeItems.reduce(
    (total, item) => total + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
    0
  )

  return (
    <CartContext.Provider
      value={{ items: safeItems, count, subtotal, addItem, updateQuantity, removeItem }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart deve ser usado dentro de CartProvider'); return context }
