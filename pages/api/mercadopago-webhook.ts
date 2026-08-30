import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    return res.status(503).json({ error: 'Mercado Pago não configurado.' })
  }

  try {
    const event = req.body || {}
    const paymentId = event?.data?.id || event?.id

    if (!paymentId) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!paymentResponse.ok) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const payment = await paymentResponse.json()
    const status = String(payment?.status || '').toLowerCase()
    const customerId = payment?.metadata?.customerId || payment?.additional_info?.items?.[0]?.id

    if (status !== 'approved' || !customerId) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const items = typeof payment?.metadata?.items === 'string' ? JSON.parse(payment.metadata.items) : []
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const supabase = getSupabaseServer()
    const productIds = items.map((item: { id: string }) => item.id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,name,price,active')
      .in('id', productIds)

    if (productsError) throw productsError
    if (!products || products.length !== productIds.length || products.some((product) => !product.active)) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const priceById = new Map(products.map((product) => [product.id, { name: product.name, price: Number(product.price) }]))
    const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => {
      const product = priceById.get(item.id)
      return total + (product ? product.price * Number(item.quantity) : 0)
    }, 0)

    const shippingTotal = Number(payment?.metadata?.shipping || 0)
    const couponCode = String(payment?.metadata?.couponCode || '')
    let discount = 0
    let effectiveShippingTotal = shippingTotal

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id,discount_percent,expires_at,usage_limit,used_count,free_shipping')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .maybeSingle()

      if (coupon && !(coupon.expires_at && new Date(coupon.expires_at) < new Date()) && !(coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) {
        discount = subtotal * Number(coupon.discount_percent || 0) / 100
        effectiveShippingTotal = coupon.free_shipping ? 0 : shippingTotal
      }
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        status: 'confirmed',
        payment_status: 'paid',
        subtotal,
        shipping: effectiveShippingTotal,
        total: subtotal + effectiveShippingTotal - discount,
      })
      .select('id')
      .single()

    if (orderError) throw orderError

    const orderItems = items.map((item: { id: string; quantity: number }) => {
      const product = priceById.get(item.id)!
      return {
        order_id: order.id,
        product_id: item.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total: product.price * item.quantity,
      }
    })

    const { error: itemError } = await supabase.from('order_items').insert(orderItems)
    if (itemError) throw itemError

    if (couponCode) {
      await supabase
        .from('coupons')
        .update({ used_count: 0 })
        .eq('code', couponCode.toUpperCase())
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Webhook inválido.' })
  }
}
