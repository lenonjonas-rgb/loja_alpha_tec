import { getSupabaseServer } from './supabase-server'

type MercadoPagoPayment = {
  id: number | string
  status?: string
  metadata?: {
    customerId?: string
    shipping?: string
    carrier?: string
    couponCode?: string
    items?: string
  }
}

export async function createOrderFromPayment(payment: MercadoPagoPayment) {
  const paymentId = String(payment.id)
  const status = String(payment?.status || '').toLowerCase()
  const customerId = payment?.metadata?.customerId

  if (status !== 'approved' || !customerId) {
    return { ignored: true as const }
  }

  const items = typeof payment?.metadata?.items === 'string' ? JSON.parse(payment.metadata.items) : []
  if (!Array.isArray(items) || !items.length) {
    return { ignored: true as const }
  }

  const supabase = getSupabaseServer()

  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('payment_reference', paymentId)
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

  const shippingTotal = Number(payment?.metadata?.shipping || 0)
  const couponCode = String(payment?.metadata?.couponCode || '')
  let discount = 0
  let effectiveShippingTotal = shippingTotal
  let appliedCoupon: { id: string; used_count: number } | null = null

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
      appliedCoupon = { id: coupon.id, used_count: coupon.used_count }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'confirmed',
      payment_status: 'paid',
      payment_reference: paymentId,
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

  if (appliedCoupon) {
    await supabase
      .from('coupons')
      .update({ used_count: appliedCoupon.used_count + 1 })
      .eq('id', appliedCoupon.id)
  }

  return { orderId: order.id, alreadyExists: false as const }
}
