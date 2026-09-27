import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdmin } from '../../lib/admin-auth'
import { getSupabaseServer } from '../../lib/supabase-server'

type CartItem = { product_name: string; internal_code: string | null; quantity: number; unit_price: number }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })

  try {
    const supabase = getSupabaseServer()
    const { data: carts, error: cartsError } = await supabase
      .from('carts')
      .select('customer_id,items,updated_at')
      .order('updated_at', { ascending: false })
    if (cartsError) throw cartsError

    const normalizedCarts = (carts || []).map((cart) => {
      const items: CartItem[] = (Array.isArray(cart.items) ? cart.items : []).flatMap((item: unknown) => {
        if (!item || typeof item !== 'object') return []
        const value = item as Record<string, unknown>
        const quantity = Number(value.quantity)
        if (typeof value.name !== 'string' || !value.name.trim() || !Number.isFinite(quantity) || quantity <= 0) return []
        return [{
          product_name: value.name,
          internal_code: typeof value.internalCode === 'string' ? value.internalCode : null,
          quantity,
          unit_price: Number(value.price) || 0,
        }]
      })
      return { customer_id: String(cart.customer_id), updated_at: cart.updated_at, items }
    }).filter((cart) => cart.items.length > 0)

    const customerIds = Array.from(new Set(normalizedCarts.map((cart) => cart.customer_id)))
    if (!customerIds.length) return res.status(200).json([])

    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id,name,email,phone')
      .in('id', customerIds)
    if (customersError) throw customersError
    const customerById = new Map((customers || []).map((customer) => [String(customer.id), customer]))

    return res.status(200).json(normalizedCarts.map((cart) => ({
      ...cart,
      customer: customerById.get(cart.customer_id) || null,
    })))
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar os carrinhos.' })
  }
}