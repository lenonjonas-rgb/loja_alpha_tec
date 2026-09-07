import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { isAdmin } from '../../lib/admin-auth'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

async function persistInvoice(supabase: ReturnType<typeof getSupabaseServer>, orderId: string, invoiceBase64: string) {
  const match = invoiceBase64.match(/^data:application\/pdf;base64,(.+)$/i)
  if (!match) throw new Error('A nota fiscal deve ser um arquivo PDF.')
  const bucket = 'order-invoices'
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined)
  const filePath = `${orderId}.pdf`
  const { error } = await supabase.storage.from(bucket).upload(filePath, Buffer.from(match[1], 'base64'), { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`
}

// o endereço do cliente vive na tabela addresses, não em customers: anexa o mais recente de cada cliente
async function attachCustomerAddresses(supabase: ReturnType<typeof getSupabaseServer>, orders: any[]) {
  const customerIds = Array.from(new Set(orders.map((order) => order.customer_id).filter(Boolean)))
  if (!customerIds.length) return orders

  const { data: addresses } = await supabase
    .from('addresses')
    .select('customer_id,cep,street,number,complement,city,state')
    .in('customer_id', customerIds)

  const addressByCustomer = new Map<string, any>()
  for (const address of addresses || []) {
    if (!addressByCustomer.has(String(address.customer_id))) addressByCustomer.set(String(address.customer_id), address)
  }

  return orders.map((order) => {
    const address = addressByCustomer.get(String(order.customer_id))
    return {
      ...order,
      customer_address: address
        ? {
          cep: address.cep || '',
          address: address.street || '',
          number: address.number || '',
          complement: address.complement || '',
          city: [address.city, address.state].filter(Boolean).join('/'),
        }
        : null,
    }
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido.' })
  if (req.method === 'GET') {
    try {
      const supabase = getSupabaseServer()
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      // prioridade absoluta ao token do cliente: nunca cair no ramo admin quando um Bearer token for enviado,
      // mesmo que exista um cookie de sessão admin ativo no mesmo navegador
      if (token) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })
        const { data, error } = await supabase.from('orders').select('id,status,payment_status,shipping,total,created_at,delivered_at,tracking_code,carrier,invoice_url,order_items(product_id,product_name,quantity,unit_price,total),product_reviews(id,rating,comment,photos,points_awarded,created_at)').eq('customer_id', user.id).order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json(data)
      }
      if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
      const { data, error } = await supabase.from('orders').select('id,customer_id,status,payment_status,payment_method,subtotal,shipping,total,created_at,tracking_code,carrier,invoice_url,shipping_address,customers(name,email,phone,document),order_items(product_name,quantity,unit_price,total)').order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json(await attachCustomerAddresses(supabase, data || []))
    } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.' }) }
  }
  if (req.method === 'PATCH' && !isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method === 'PATCH') {
    const { id, status, paymentStatus, trackingCode, invoiceBase64 } = req.body || {}
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
    const allowedPayments = ['pending', 'paid', 'failed', 'refunded']
    if (!id || !allowedStatuses.includes(status) || !allowedPayments.includes(paymentStatus)) return res.status(400).json({ error: 'Pedido e status válidos são obrigatórios.' })
    if (status === 'shipped' && !String(trackingCode || '').trim()) return res.status(400).json({ error: 'Informe o código de rastreio antes de enviar o pedido.' })
    try {
      const supabase = getSupabaseServer()
      const { data: previousOrder, error: previousOrderError } = await supabase.from('orders').select('status').eq('id', id).single()
      if (previousOrderError) throw previousOrderError
      const updatePayload: Record<string, unknown> = { status, payment_status: paymentStatus, tracking_code: String(trackingCode || '').trim() || null }
      if (status === 'delivered' && previousOrder.status !== 'delivered') updatePayload.delivered_at = new Date().toISOString()
      if (invoiceBase64) updatePayload.invoice_url = await persistInvoice(supabase, id, invoiceBase64)
      const { data, error } = await supabase.from('orders').update(updatePayload).eq('id', id).select('id,customer_id,status,payment_status,payment_method,subtotal,shipping,total,created_at,tracking_code,carrier,invoice_url,shipping_address,customers(name,email,phone,document),order_items(product_name,quantity,unit_price,total)').single()
      if (error) throw error
      if (data.customer_id && data.status !== previousOrder.status) {
        const orderLabel: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
        await supabase.from('notifications').insert({ customer_id: data.customer_id, order_id: data.id, title: 'Atualização do pedido', message: `Seu pedido agora está: ${orderLabel[data.status] || data.status}.`, status: data.status })
      }
      const [enriched] = await attachCustomerAddresses(supabase, [data])
      return res.status(200).json(enriched)
    } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.' }) }
  }
  if (req.method === 'DELETE') {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Pedido não informado.' })
    try {
      const supabase = getSupabaseServer()
      const { data: order, error: orderError } = await supabase.from('orders').select('id,status').eq('id', id).maybeSingle()
      if (orderError) throw orderError
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' })
      if (order.status !== 'cancelled') return res.status(400).json({ error: 'Somente pedidos cancelados podem ser excluídos.' })
      const { error } = await supabase.from('orders').delete().eq('id', id).eq('status', 'cancelled')
      if (error) throw error
      return res.status(200).json({ deleted: true, id })
    } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível excluir o pedido.' }) }
  }
  const { customerId, items, shipping, paymentMethod, couponCode, carrier } = req.body || {}
  if (!customerId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
  try {
    const supabase = getSupabaseServer()
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user || user.id !== customerId) return res.status(401).json({ error: 'Sessão inválida.' })
    const productIds = items.map((item: { id: string }) => item.id)
    const { data: products, error: productsError } = await supabase.from('products').select('id,name,price,active,discount_percent').in('id', productIds)
    if (productsError) throw productsError
    if (!products || products.length !== productIds.length || products.some((product) => !product.active)) return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    const priceById = new Map(products.map((product) => { const basePrice = Number(product.price); const discountPercent = Number(product.discount_percent || 0); const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice; return [product.id, { name: product.name, price: finalPrice }] }))
    const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => { const product = priceById.get(item.id); return total + (product ? product.price * Number(item.quantity) : 0) }, 0)
    let shippingTotal = Number(shipping) || 0
    let discount = 0
    let appliedCoupon: { id: string; used_count: number } | null = null
    if (couponCode) { const { data: coupon } = await supabase.from('coupons').select('id,discount_percent,expires_at,usage_limit,used_count,free_shipping').eq('code', String(couponCode).toUpperCase()).eq('active', true).maybeSingle(); if (!coupon || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) return res.status(400).json({ error: 'Cupom inválido, expirado ou esgotado.' }); discount = subtotal * Number(coupon.discount_percent || 0) / 100; shippingTotal = coupon.free_shipping ? 0 : shippingTotal; appliedCoupon = { id: coupon.id, used_count: coupon.used_count } }
    const { data: order, error: orderError } = await supabase.from('orders').insert({ customer_id: customerId, status: 'pending', payment_status: 'pending', payment_method: paymentMethod || null, coupon_code: couponCode ? String(couponCode).toUpperCase() : null, carrier: carrier || null, subtotal, shipping: shippingTotal, total: subtotal + shippingTotal - discount }).select('id').single()
    if (orderError) throw orderError
    const orderItems = items.map((item: { id: string; quantity: number }) => { const product = priceById.get(item.id)!; return { order_id: order.id, product_id: item.id, product_name: product.name, quantity: item.quantity, unit_price: product.price, total: product.price * item.quantity } })
    const { error: itemError } = await supabase.from('order_items').insert(orderItems)
    if (itemError) throw itemError
    if (appliedCoupon) await supabase.from('coupons').update({ used_count: appliedCoupon.used_count + 1 }).eq('id', appliedCoupon.id)
    return res.status(201).json({ orderId: order.id, paymentMethod })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível registrar o pedido.' }) }
}
