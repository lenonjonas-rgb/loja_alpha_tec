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

  const { data: confirmed, error: confirmationError } = await supabase.rpc('confirm_paid_order', { p_order_id: order.id })
  if (confirmationError) throw confirmationError
  if (!confirmed) return { orderId: order.id, alreadyExists: true as const }

  return { orderId: order.id, alreadyExists: false as const }
}
