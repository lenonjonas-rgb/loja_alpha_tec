import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const { customerId, items, shipping, paymentMethod } = req.body || {}
  if (!customerId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
  try {
    const supabase = getSupabaseServer()
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user || user.id !== customerId) return res.status(401).json({ error: 'Sessão inválida.' })
    const productIds = items.map((item: { id: string }) => item.id)
    const { data: products, error: productsError } = await supabase.from('products').select('id,name,price,active').in('id', productIds)
    if (productsError) throw productsError
    if (!products || products.length !== productIds.length || products.some((product) => !product.active)) return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    const priceById = new Map(products.map((product) => [product.id, { name: product.name, price: Number(product.price) }]))
    const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => { const product = priceById.get(item.id); return total + (product ? product.price * Number(item.quantity) : 0) }, 0)
    const shippingTotal = Number(shipping) || 0
    const { data: order, error: orderError } = await supabase.from('orders').insert({ customer_id: customerId, status: 'pending', payment_status: 'pending', subtotal, shipping: shippingTotal, total: subtotal + shippingTotal }).select('id').single()
    if (orderError) throw orderError
    const orderItems = items.map((item: { id: string; quantity: number }) => { const product = priceById.get(item.id)!; return { order_id: order.id, product_id: item.id, product_name: product.name, quantity: item.quantity, unit_price: product.price, total: product.price * item.quantity } })
    const { error: itemError } = await supabase.from('order_items').insert(orderItems)
    if (itemError) throw itemError
    return res.status(201).json({ orderId: order.id, paymentMethod })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível registrar o pedido.' }) }
}
