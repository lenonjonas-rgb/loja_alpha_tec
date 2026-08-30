import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getStripe } from '../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const { customerId, items, shipping, carrier, couponCode, successUrl, cancelUrl, paymentMethod } = req.body || {}
    if (!customerId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
    }

    const selectedMethod = String(paymentMethod || 'mercadopago').toLowerCase()
    if (selectedMethod !== 'mercadopago' && selectedMethod !== 'stripe') {
      return res.status(400).json({ error: 'Método de pagamento inválido. Use mercadopago ou stripe.' })
    }

    if (selectedMethod === 'mercadopago') {
      const accessToken = process.env.MP_ACCESS_TOKEN
      if (!accessToken) {
        return res.status(503).json({ error: 'Mercado Pago não configurado. Defina MP_ACCESS_TOKEN na Vercel para ativar o pagamento.' })
      }

      const supabase = getSupabaseServer()
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id,name,price,active,discount_percent,image_url')
        .in('id', items.map((item: { id: string }) => item.id))

      if (productsError) throw productsError
      if (!products || products.length !== items.length || products.some((product) => !product.active)) {
        return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const toAbsoluteUrl = (path: string) => (path && /^https?:\/\//i.test(path) ? path : path ? `${appUrl}${path.startsWith('/') ? '' : '/'}${path}` : `${appUrl}/logo-header-uniform.jpg`)
      const productById = new Map(products.map((product) => {
        const basePrice = Number(product.price)
        const discountPercent = Number(product.discount_percent || 0)
        const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice
        return [product.id, { name: product.name, price: finalPrice, pictureUrl: toAbsoluteUrl(product.image_url) }]
      }))
      let subtotal = 0
      for (const item of items as Array<{ id: string; quantity: number }>) {
        subtotal += (productById.get(item.id)?.price || 0) * Number(item.quantity)
      }

      let discount = 0
      let shippingTotal = Number(shipping || 0)
      if (couponCode) {
        const { data: coupon, error: couponError } = await supabase
          .from('coupons')
          .select('discount_percent,expires_at,usage_limit,used_count,free_shipping')
          .eq('code', String(couponCode).toUpperCase())
          .eq('active', true)
          .maybeSingle()

        if (couponError) throw couponError
        if (!coupon || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) {
          return res.status(400).json({ error: 'Cupom inválido, expirado ou esgotado.' })
        }

        discount = subtotal * Number(coupon.discount_percent || 0) / 100
        if (coupon.free_shipping) {
          shippingTotal = 0
        }
      }

      // aplica o desconto do cupom proporcionalmente ao preço de cada item, preservando a imagem/nome real do produto
      const discountFactor = subtotal > 0 ? Math.max(0, (subtotal - discount) / subtotal) : 1
      const preferenceItems = (items as Array<{ id: string; quantity: number }>).map((item) => {
        const product = productById.get(item.id)!
        return {
          id: item.id,
          title: product.name,
          picture_url: product.pictureUrl,
          quantity: Number(item.quantity),
          unit_price: Number((product.price * discountFactor).toFixed(2)),
          currency_id: 'BRL',
        }
      })
      if (shippingTotal > 0) {
        preferenceItems.push({
          id: 'frete',
          title: `Frete - ${carrier || 'Correios'}`,
          picture_url: `${appUrl}/logo-header-uniform.jpg`,
          quantity: 1,
          unit_price: Number(shippingTotal.toFixed(2)),
          currency_id: 'BRL',
        })
      }

      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: preferenceItems,
          payer: {
            email: 'cliente@exemplo.com',
          },
          metadata: {
            customerId: String(customerId),
            shipping: String(shippingTotal || 0),
            carrier: String(carrier || 'Correios'),
            couponCode: String(couponCode || ''),
            items: JSON.stringify(items),
          },
          back_urls: {
            success: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=success`,
            failure: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=cancelled`,
            pending: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=cancelled`,
          },
          auto_return: 'approved',
          notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mercadopago-webhook`,
          // sem excluded_payment_methods/types: mantém PIX, boleto e cartão disponíveis no Checkout Pro
          payment_methods: {
            excluded_payment_methods: [],
            excluded_payment_types: [],
            installments: 12,
          },
        }),
      })

      const mpData = await mpResponse.json()
      if (!mpResponse.ok) {
        return res.status(502).json({ error: mpData?.message || 'Não foi possível criar a preferência do Mercado Pago.' })
      }

      const url = mpData.init_point || mpData.sandbox_init_point || null
      return res.status(200).json({ sessionId: mpData.id || '', url })
    }

    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY na Vercel para ativar o pagamento.' })
    }

    const supabase = getSupabaseServer()
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,name,price,active,discount_percent')
      .in('id', items.map((item: { id: string }) => item.id))

    if (productsError) throw productsError
    if (!products || products.length !== items.length || products.some((product) => !product.active)) {
      return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    }

    const priceById = new Map(products.map((product) => {
      const basePrice = Number(product.price)
      const discountPercent = Number(product.discount_percent || 0)
      const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice
      return [product.id, finalPrice]
    }))
    const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => {
      const unitPrice = priceById.get(item.id) || 0
      return total + unitPrice * Number(item.quantity)
    }, 0)

    let discount = 0
    const shippingTotal = Number(shipping || 0)
    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('discount_percent,expires_at,usage_limit,used_count,free_shipping')
        .eq('code', String(couponCode).toUpperCase())
        .eq('active', true)
        .maybeSingle()

      if (couponError) throw couponError
      if (!coupon || (coupon.expires_at && new Date(coupon.expires_at) < new Date()) || (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) {
        return res.status(400).json({ error: 'Cupom inválido, expirado ou esgotado.' })
      }

      discount = subtotal * Number(coupon.discount_percent || 0) / 100
      if (coupon.free_shipping) {
        return res.status(200).json({ sessionId: '', url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=success` })
      }
    }

    const total = Math.max(0, subtotal + shippingTotal - discount)

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
