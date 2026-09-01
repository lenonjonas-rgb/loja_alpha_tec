import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getStripe } from '../../lib/stripe'

type PricedProduct = { name: string; price: number; pictureUrl: string }

async function loadPricedProducts(supabase: ReturnType<typeof getSupabaseServer>, items: Array<{ id: string; quantity: number }>, appUrl: string) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id,name,price,active,discount_percent,image_url')
    .in('id', items.map((item) => item.id))

  if (error) throw error
  if (!products || products.length !== items.length || products.some((product) => !product.active)) {
    return null
  }

  const toAbsoluteUrl = (path: string) => (path && /^https?:\/\//i.test(path) ? path : path ? `${appUrl}${path.startsWith('/') ? '' : '/'}${path}` : `${appUrl}/logo-header-uniform.jpg`)
  const productById = new Map<string, PricedProduct>(products.map((product) => {
    const basePrice = Number(product.price)
    const discountPercent = Number(product.discount_percent || 0)
    const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice
    return [product.id, { name: product.name, price: finalPrice, pictureUrl: toAbsoluteUrl(product.image_url) }]
  }))
  return productById
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const { customerId, items, shipping, carrier, couponCode, successUrl, cancelUrl, paymentMethod } = req.body || {}
    if (!customerId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cliente e itens são obrigatórios.' })
    }

    const selectedMethod = String(paymentMethod || 'pix').toLowerCase()
    if (!['pix', 'card', 'boleto'].includes(selectedMethod)) {
      return res.status(400).json({ error: 'Método de pagamento inválido. Use pix, card ou boleto.' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const supabase = getSupabaseServer()
    const productById = await loadPricedProducts(supabase, items, appUrl)
    if (!productById) {
      return res.status(400).json({ error: 'Um ou mais produtos não estão disponíveis.' })
    }

    let subtotal = 0
    for (const item of items as Array<{ id: string; quantity: number }>) {
      subtotal += (productById.get(item.id)?.price || 0) * Number(item.quantity)
    }

    let discount = 0
    let shippingTotal = Number(shipping || 0)
    const normalizedCouponCode = couponCode ? String(couponCode).toUpperCase() : ''
    if (normalizedCouponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('discount_percent,expires_at,usage_limit,used_count,free_shipping')
        .eq('code', normalizedCouponCode)
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

    const total = Math.max(0, subtotal + shippingTotal - discount)
    // referência única gerada por nós: usada para criar o pedido "pending" antes do pagamento e depois confirmá-lo,
    // sem depender do metadata do gateway (que nem sempre é propagado do lado deles)
    const paymentReference = crypto.randomUUID()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        status: 'pending',
        payment_status: 'pending',
        payment_reference: paymentReference,
        coupon_code: normalizedCouponCode || null,
        payment_method: selectedMethod,
        subtotal,
        shipping: shippingTotal,
        total,
      })
      .select('id')
      .single()

    if (orderError) throw orderError
    if (!order) throw new Error('Não foi possível criar o pedido.')
    const orderId = order.id

    const orderItems = (items as Array<{ id: string; quantity: number }>).map((item) => {
      const product = productById.get(item.id)!
      return {
        order_id: orderId,
        product_id: item.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total: product.price * item.quantity,
      }
    })
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
    if (itemsError) throw itemsError

    async function rollbackOrder() {
      await supabase.from('order_items').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
    }

    if (selectedMethod === 'pix') {
      const accessToken = process.env.MP_ACCESS_TOKEN
      if (!accessToken) {
        await rollbackOrder()
        return res.status(503).json({ error: 'Mercado Pago não configurado. Defina MP_ACCESS_TOKEN na Vercel para ativar o pagamento.' })
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
          external_reference: paymentReference,
          back_urls: {
            success: successUrl || `${appUrl}/checkout?payment=success`,
            failure: cancelUrl || `${appUrl}/checkout?payment=cancelled`,
            // pix pode ficar "pending" por alguns segundos após o pagamento: trata como sucesso para o cliente ver a confirmação assim que aprovar
            pending: successUrl || `${appUrl}/checkout?payment=success`,
          },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/mercadopago-webhook`,
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
        await rollbackOrder()
        return res.status(502).json({ error: mpData?.message || 'Não foi possível criar a preferência do Mercado Pago.' })
      }

      const url = mpData.init_point || mpData.sandbox_init_point || null
      return res.status(200).json({ orderId, externalReference: paymentReference, url })
    }

    const stripe = getStripe()
    if (!stripe) {
      await rollbackOrder()
      return res.status(503).json({ error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY na Vercel para ativar o pagamento.' })
    }

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
    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [selectedMethod === 'boleto' ? 'boleto' : 'card'],
        line_items: lineItems,
        client_reference_id: paymentReference,
        success_url: `${baseSuccessUrl}${baseSuccessUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${appUrl}/checkout?payment=cancelled`,
      })
    } catch (stripeError) {
      await rollbackOrder()
      throw stripeError
    }

    // atualiza a referência do pedido para o id real da sessão do Stripe (facilita conferência e idempotência)
    await supabase.from('orders').update({ payment_reference: session.id }).eq('id', orderId)

    return res.status(200).json({ orderId, sessionId: session.id, url: session.url })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível criar a sessão de pagamento.' })
  }
}

