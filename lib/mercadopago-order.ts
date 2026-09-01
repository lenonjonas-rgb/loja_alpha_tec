import { getSupabaseServer } from './supabase-server'
import { sendOrderConfirmationEmail } from './order-email'

type MercadoPagoPayment = {
  id: number | string
  status?: string
  external_reference?: string | null
}

export async function createOrderFromPayment(payment: MercadoPagoPayment) {
  const status = String(payment?.status || '').toLowerCase()
  const externalReference = payment?.external_reference

  if (status !== 'approved' || !externalReference) {
    return { ignored: true as const }
  }

  const supabase = getSupabaseServer()

  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select('id,payment_status,coupon_code')
    .eq('payment_reference', String(externalReference))
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

  await sendOrderConfirmationEmail(order.id).catch(() => undefined)

  return { orderId: order.id, alreadyExists: false as const }
}
