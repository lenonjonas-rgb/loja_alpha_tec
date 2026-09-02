import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido.' })

  const supabase = getSupabaseServer()
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('carts').select('items').eq('customer_id', user.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ items: Array.isArray(data?.items) ? data.items : [] })
  }

  const { items } = req.body || {}
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items deve ser uma lista.' })
  const { error } = await supabase.from('carts').upsert({ customer_id: user.id, items, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ items })
}
