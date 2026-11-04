type Coupon = {
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  customer_id: string | null
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
