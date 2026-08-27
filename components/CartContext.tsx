import { createContext, useContext, useEffect, useState } from 'react'
import type { Product } from '../lib/products'

export type CartItem = Product & { quantity: number }
type CartContextValue = { items: CartItem[]; count: number; subtotal: number; addItem: (product: Product) => void; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void }
const CartContext = createContext<CartContextValue | null>(null)
const storageKey = 'alpha-tec-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  useEffect(() => { setItems(JSON.parse(localStorage.getItem(storageKey) || '[]')) }, [])
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(items)) }, [items])
  function addItem(product: Product) { setItems((current) => { const existing = current.find((item) => item.id === product.id); return existing ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }] }) }
  function updateQuantity(id: string, quantity: number) { setItems((current) => quantity > 0 ? current.map((item) => item.id === id ? { ...item, quantity } : item) : current.filter((item) => item.id !== id)) }
  function removeItem(id: string) { setItems((current) => current.filter((item) => item.id !== id)) }
  return <CartContext.Provider value={{ items, count: items.reduce((total, item) => total + item.quantity, 0), subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0), addItem, updateQuantity, removeItem }}>{children}</CartContext.Provider>
}

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart deve ser usado dentro de CartProvider'); return context }
