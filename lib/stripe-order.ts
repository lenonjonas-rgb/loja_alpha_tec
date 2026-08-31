import { getSupabaseServer } from './supabase-server'

type StripeSessionLike = {
  id: string
  payment_status?: string | null
  metadata?: {
    customerId?: string
    shipping?: string
    carrier?: string
    couponCode?: string
    items?: string
  } | null
}

export async function createOrderFromStripeSession(session: StripeSessionLike) {
  const paymentReference = String(session.id)
  const paymentStatus = String(session?.payment_status || '').toLowerCase()
  const customerId = session?.metadata?.customerId

  if (paymentStatus !== 'paid' || !customerId) {
    return { ignored: true as const }
  }

  const items = typeof session?.metadata?.items === 'string' ? JSON.parse(session.metadata.items) : []
  if (!Array.isArray(items) || !items.length) {
    return { ignored: true as const }
  }

  const supabase = getSupabaseServer()

  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('payment_reference', paymentReference)
    .maybeSingle()

  if (existingOrder) {
    return { orderId: existingOrder.id, alreadyExists: true as const }
  }

  const productIds = items.map((item: { id: string }) => item.id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,name,price,active,discount_percent')
    .in('id', productIds)

  if (productsError) throw productsError
  if (!products || products.length !== productIds.length || products.some((product) => !product.active)) {
    return { ignored: true as const }
  }

  const priceById = new Map(products.map((product) => {
    const basePrice = Number(product.price)
    const discountPercent = Number(product.discount_percent || 0)
    const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice
    return [product.id, { name: product.name, price: finalPrice }]
  }))
  const subtotal = items.reduce((total: number, item: { id: string; quantity: number }) => {
    const product = priceById.get(item.id)
    return total + (product ? product.price * Number(item.quantity) : 0)
  }, 0)

  const shippingTotal = Number(session?.metadata?.shipping || 0)
  const couponCode = String(session?.metadata?.couponCode || '')
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
      payment_reference: paymentReference,
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

  return { orderId: order.id, alreadyExists: false as const }
}
