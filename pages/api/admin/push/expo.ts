import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdmin } from '../../../../lib/admin-auth'
import { getSupabaseServer } from '../../../../lib/supabase-server'

const expoTokenPattern = /^(Expo|Exponent)PushToken\[[A-Za-z0-9+/_=-]+\]$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })

  const token = String(req.body?.token || '')
  if (!expoTokenPattern.test(token)) return res.status(400).json({ error: 'Token de notificação Expo inválido.' })

  const supabase = getSupabaseServer()
  const endpoint = `expo:${token}`
  const { error } = await supabase
    .from('admin_push_subscriptions')
    .upsert({ endpoint, subscription: { expoPushToken: token }, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) return res.status(500).json({ error: 'Não foi possível registrar as notificações deste dispositivo.' })
  return res.status(201).json({ ok: true })
}