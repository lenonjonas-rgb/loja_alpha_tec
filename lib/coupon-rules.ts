import type { getSupabaseServer } from './supabase-server'

type Coupon = {
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  customer_id: string | null
}

export async function getCustomerCouponError(
  supabase: ReturnType<typeof getSupabaseServer>,
  coupon: (Coupon & { code: string }) | null,
  customerId?: string | null,
): Promise<string | null> {
  const error = getCouponError(coupon, customerId)
  if (error || coupon?.code !== 'COMPRA10') return error
  if (!customerId) return 'Entre na conta que recebeu a oferta COMPRA10 para utilizá-la.'
  const { data: offer, error: offerError } = await supabase.from('cart_recovery_offers')
    .select('expires_at,redeemed_order_id').eq('customer_id', customerId).maybeSingle()
  if (offerError) throw offerError
  if (!offer) return 'O cupom COMPRA10 ainda não foi liberado para sua conta.'
  if (offer.redeemed_order_id) return 'Você já utilizou o cupom COMPRA10.'
  if (new Date(offer.expires_at).getTime() <= Date.now()) return 'Sua oferta COMPRA10 expirou.'
  return null
}

export function getCouponError(coupon: Coupon | null, customerId?: string | null): string | null {
  if (!coupon || (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) ||
    (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)) {
    return 'Cupom inválido, expirado ou esgotado.'
  }
  if (coupon.customer_id && coupon.customer_id !== customerId) {
    return 'Este cupom é exclusivo para a conta do cliente que recebeu a oferta. Entre nessa conta para utilizá-lo.'
  }
  return null
}
