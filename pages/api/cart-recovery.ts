import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRole } from '../../lib/admin-auth'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getCartRecoveryMessage, normalizeWhatsAppPhone } from '../../lib/order-whatsapp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!requireRole(req, res, ['administrativo', 'master'])) return
  const customerId = req.body?.customerId
  if (typeof customerId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(customerId)) {
    return res.status(400).json({ error: 'Cliente inválido.' })
  }
  try {
    const supabase = getSupabaseServer()
    const { data: customer, error: customerError } = await supabase.from('customers').select('name,phone').eq('id', customerId).single()
    if (customerError) throw customerError
    const phone = normalizeWhatsAppPhone(customer.phone)
    if (!phone) return res.status(400).json({ error: 'O cliente não possui um telefone válido para WhatsApp. Nenhum cupom foi criado.' })
    const { data, error } = await supabase.rpc('create_cart_recovery_coupon', { p_customer_id: customerId })
    if (error) {
      if (error.code === 'P0001') return res.status(409).json({ error: error.message })
      throw error
    }
    const coupon = Array.isArray(data) ? data[0] : null
    if (!coupon || typeof coupon.code !== 'string' || typeof coupon.expires_at !== 'string' || !Number.isFinite(Date.parse(coupon.expires_at))) {
      throw new Error('Resposta inválida ao criar cupom de recuperação.')
    }
    const message = getCartRecoveryMessage(customer.name, coupon.code, coupon.expires_at)
    return res.status(201).json({ code: coupon.code, expiresAt: coupon.expires_at, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` })
  } catch (error) {
    console.error('Falha ao criar cupom de recuperação do carrinho:', error)
    return res.status(500).json({ error: 'Não foi possível criar o cupom. Verifique a configuração de scripts/cart-recovery.sql no Supabase e tente novamente.' })
  }
}
