import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getStripe } from '../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const { customerId, items, shipping, carrier, couponCode, successUrl, cancelUrl, paymentMethod, externalReference } = req.body || {}
    if (!customerId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
    }

    const selectedMethod = String(paymentMethod || 'pix').toLowerCase()
    if (!['pix', 'card', 'boleto'].includes(selectedMethod)) {
      return res.status(400).json({ error: 'Método de pagamento inválido. Use pix, card ou boleto.' })
    }

    if (selectedMethod === 'pix') {
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
          external_reference: externalReference ? String(externalReference) : undefined,
          back_urls: {
            success: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=success`,
            failure: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=cancelled`,
            // pix pode ficar "pending" por alguns segundos após o pagamento: trata como sucesso para o cliente ver a confirmação assim que aprovar
            pending: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout?payment=success`,
          },
          auto_return: 'approved',
          notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mercadopago-webhook`,
          // restringe a preferência para exibir apenas Pix (bank_transfer no Brasil)
          payment_methods: {
            excluded_payment_types: [
              { id: 'credit_card' },
              { id: 'debit_card' },
              { id: 'prepaid_card' },
              { id: 'ticket' },
              { id: 'atm' },
              { id: 'digital_wallet' },
              { id: 'digital_currency' },
            ],
          },
        }),
      })

      const mpData = await mpResponse.json()
      if (!mpResponse.ok) {
        return res.status(502).json({ error: mpData?.message || 'Não foi possível criar a preferência do Mercado Pago.' })
      }

      const url = mpData.init_point || mpData.sandbox_init_point || null
      return res.status(200).json({ sessionId: mpData.id || '', url, externalReference: externalReference || '' })
    }

    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY na Vercel para ativar o pagamento.' })
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
    const lineItems = (items as Array<{ id: string; quantity: number }>).map((item) => {
      const product = productById.get(item.id)!
      return {
        price_data: {
          currency: 'brl',
          product_data: {
            name: product.name,
            images: [product.pictureUrl],
          },
          unit_amount: Math.round(product.price * discountFactor * 100),
        },
        quantity: Number(item.quantity),
      }
    })
    if (shippingTotal > 0) {
      lineItems.push({
        price_data: {
          currency: 'brl',
          product_data: {
            name: `Frete - ${carrier || 'Correios'}`,
            images: [`${appUrl}/logo-header-uniform.jpg`],
          },
          unit_amount: Math.round(shippingTotal * 100),
        },
        quantity: 1,
      })
    }

    const baseSuccessUrl = successUrl || `${appUrl}/checkout?payment=success`
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: [selectedMethod === 'boleto' ? 'boleto' : 'card'],
      line_items: lineItems,
      metadata: {
        customerId: String(customerId),
        shipping: String(shippingTotal || 0),
        carrier: String(carrier || 'Correios'),
        couponCode: String(couponCode || ''),
        items: JSON.stringify(items),
      },
      success_url: `${baseSuccessUrl}${baseSuccessUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appUrl}/checkout?payment=cancelled`,
    })

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível criar a sessão de pagamento.' })
  }
}
