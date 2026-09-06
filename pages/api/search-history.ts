import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

const MAX_TERM_LENGTH = 120

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })

  try {
    const supabase = getSupabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('search_history')
        .select('id,term,created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error

      // agrupa por termo mantendo a busca mais recente de cada um
      const seen = new Set<string>()
      const unique = (data || []).filter((item) => {
        const key = item.term.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return res.status(200).json(unique.slice(0, 30))
    }

    if (req.method === 'POST') {
      const term = String(req.body?.term || '').trim().slice(0, MAX_TERM_LENGTH)
      if (!term) return res.status(400).json({ error: 'Termo vazio.' })

      // evita duplicar quando o cliente recarrega a mesma página de busca
      const { data: last } = await supabase
        .from('search_history')
        .select('id,term')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (last?.[0] && last[0].term.toLowerCase() === term.toLowerCase()) {
        return res.status(200).json({ ok: true })
      }

      const { error } = await supabase.from('search_history').insert({ customer_id: user.id, term })
      if (error) throw error
      return res.status(201).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      const query = supabase.from('search_history').delete().eq('customer_id', user.id)
      const { error } = id ? await query.eq('id', id) : await query
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o histórico.' })
  }
}
