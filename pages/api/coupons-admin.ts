import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

function isAdmin(req: NextApiRequest) {
  const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.')
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
  const supabase = getSupabaseServer()
  try {
    if (req.method === 'GET') { const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); if (error) throw error; return res.status(200).json(data) }
    if (req.method === 'POST') { const { code, discountPercent, expiresAt, usageLimit } = req.body || {}; if (!code || Number(discountPercent) <= 0 || Number(discountPercent) > 100) return res.status(400).json({ error: 'Informe código e desconto entre 1 e 100%.' }); const { data, error } = await supabase.from('coupons').insert({ code: String(code).trim().toUpperCase(), discount_percent: Number(discountPercent), expires_at: expiresAt || null, usage_limit: usageLimit ? Number(usageLimit) : null }).select('*').single(); if (error) throw error; return res.status(201).json(data) }
    if (req.method === 'PATCH') { const { id, active } = req.body || {}; const { data, error } = await supabase.from('coupons').update({ active: Boolean(active) }).eq('id', id).select('*').single(); if (error) throw error; return res.status(200).json(data) }
    if (req.method === 'DELETE') { const { error } = await supabase.from('coupons').delete().eq('id', req.query.id); if (error) throw error; return res.status(204).end() }
    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível gerenciar os cupons.' }) }
}
