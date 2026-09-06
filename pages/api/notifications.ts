import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

async function getUser(req: NextApiRequest) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ? { supabase, user } : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const auth = await getUser(req)
    if (!auth) return res.status(401).json({ error: 'Sessão inválida.' })
    if (req.method === 'GET') {
      const { data, error } = await auth.supabase.from('notifications').select('id,order_id,title,message,status,read_at,created_at').eq('customer_id', auth.user.id).order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      return res.status(200).json(data || [])
    }
    const { id } = req.body || {}
    const query = auth.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('customer_id', auth.user.id)
    const { error } = id ? await query.eq('id', id) : await query.is('read_at', null)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar as notificações.' })
  }
}