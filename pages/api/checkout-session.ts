import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getStripe } from '../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const { customerId, items, shipping, carrier, couponCode, successUrl, cancelUrl } = req.body || {}
    if (!customerId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
    }

    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY na Vercel para ativar o pagamento.' })
    }

    const supabase = getSupabaseServer()
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,name,price,active')
      .in('id', items.map((item: { id: string }) => item.id))

    if (productsError) throw productsError
    if (!products || products.length !== items.length || products.some((product) => !product.active)) {
      return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    }

    const priceById = new Map(products.map((product) => [product.id, Number(product.price)]))
    const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => {
      const unitPrice = priceById.get(item.id) || 0
      return total + unitPrice * Number(item.quantity)
    }, 0)

    let discount = 0
    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('discount_percent,expires_at,usage_limit,used_count')
        .eq('code', String(couponCode).toUpperCase())
        .eq('active', true)
        .maybeSingle()

      if (couponError) throw couponError
      if (!coupon || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) {
        return res.status(400).json({ error: 'Cupom inválido, expirado ou esgotado.' })
      }

      discount = subtotal * Number(coupon.discount_percent) / 100
    }

    const total = Math.max(0, subtotal + Number(shipping || 0) - discount)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Compra Alpha Tec - ${carrier || 'Frete'}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        customerId: String(customerId),
        shipping: String(shipping || 0),
        carrier: String(carrier || 'Correios'),
        couponCode: String(couponCode || ''),
        items: JSON.stringify(items),
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=success`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=cancelled`,
    })

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível criar a sessão de pagamento.' })
  }
}
