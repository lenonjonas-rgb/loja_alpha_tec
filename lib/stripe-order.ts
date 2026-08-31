import { getSupabaseServer } from './supabase-server'

type StripeSessionLike = {
  id: string
  payment_status?: string | null
}

export async function createOrderFromStripeSession(session: StripeSessionLike) {
  const paymentReference = String(session.id)
  const paymentStatus = String(session?.payment_status || '').toLowerCase()

  if (paymentStatus !== 'paid') {
    return { ignored: true as const }
  }

  const supabase = getSupabaseServer()

  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select('id,payment_status,coupon_code')
    .eq('payment_reference', paymentReference)
    .maybeSingle()

  if (orderFetchError) throw orderFetchError
  if (!order) {
    return { ignored: true as const }
  }
  if (order.payment_status === 'paid') {
    return { orderId: order.id, alreadyExists: true as const }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', order.id)

  if (updateError) throw updateError

  if (order.coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id,used_count')
      .eq('code', order.coupon_code)
      .maybeSingle()

    if (coupon) {
      await supabase
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('id', coupon.id)
    }
  }

  return { orderId: order.id, alreadyExists: false as const }
}
