import { timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../../lib/supabase-server'
import { sendAdminPush } from '../../../lib/admin-push'

export const config = { maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const secret = process.env.CART_NOTIFICATIONS_SECRET
  if (!secret || secret.length < 32) {
    console.error('CART_NOTIFICATIONS_SECRET ausente ou inválido.')
    return res.status(503).json({ error: 'Agendamento de carrinhos não configurado.' })
  }
  const provided = Buffer.from(req.headers.authorization || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  try {
    const supabase = getSupabaseServer()
    const { data: carts, error } = await supabase.rpc('claim_pending_cart_notifications')
    if (error) throw error
    let notified = 0
    let retry = 0
    let failed = 0
    for (const cart of carts || []) {
      try {
        const { data: current, error: currentError } = await supabase.from('carts')
          .select('pending_version,pending_since').eq('customer_id', cart.customer_id).maybeSingle()
        if (currentError) throw currentError
        if (!current || current.pending_version !== cart.pending_version || !current.pending_since) continue
        const result = await sendAdminPush({
          title: 'Pedido pendente',
          body: 'Um cliente está há 3 horas com produtos no carrinho sem concluir o pagamento.',
        })
        if (result.sent > 0) {
          notified++
        } else {
          retry++
          const { error: releaseError } = await supabase.rpc('release_pending_cart_notification', {
            p_customer_id: cart.customer_id, p_version: cart.pending_version,
          })
          if (releaseError) throw releaseError
          console.warn('Aviso de carrinho sem destinatários alcançados; nova tentativa agendada.', cart.customer_id)
        }
      } catch (pushError) {
        console.error('Falha ao processar aviso de carrinho:', pushError)
        failed++
        const { error: releaseError } = await supabase.rpc('release_pending_cart_notification', {
          p_customer_id: cart.customer_id, p_version: cart.pending_version,
        })
        if (releaseError) console.error('Falha ao liberar nova tentativa do aviso:', releaseError)
      }
    }
    if (failed) return res.status(500).json({ error: 'Alguns avisos não puderam ser processados.', notified, retry, failed })
    return res.status(200).json({ notified, retry })
  } catch (error) {
    console.error('Falha no agendamento de avisos de carrinho:', error)
    return res.status(500).json({ error: 'Não foi possível processar os avisos de carrinho.' })
  }
}
