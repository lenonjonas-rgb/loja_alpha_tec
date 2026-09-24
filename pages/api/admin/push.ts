import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdmin } from '../../../lib/admin-auth'
import { getSupabaseServer } from '../../../lib/supabase-server'
import { sendAdminPush } from '../../../lib/admin-push'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  if (req.method === 'GET') return res.status(200).json({ publicKey, configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) })
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido.' })
  if (!publicKey || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return res.status(503).json({ error: 'As chaves de notificação ainda não foram configuradas no servidor.' })

  if (req.method === 'POST' && req.body?.test === true) {
    const result = await sendAdminPush({ title: 'Alertas ativos', body: 'Este celular está pronto para receber novos pedidos e leads.' })
    if (!result.sent) return res.status(502).json({ error: 'O servidor não conseguiu entregar o alerta. Verifique as permissões do navegador e as chaves VAPID.' })
    return res.status(200).json(result)
  }

  const endpoint = String(req.body?.endpoint || '')
  if (!endpoint.startsWith('https://')) return res.status(400).json({ error: 'Inscrição de notificação inválida.' })

  const supabase = getSupabaseServer()
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('admin_push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  const subscription = req.body
  if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: 'Chaves de notificação inválidas.' })
  const { error } = await supabase.from('admin_push_subscriptions').upsert({ endpoint, subscription, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ ok: true })
}
