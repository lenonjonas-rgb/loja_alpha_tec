import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const code = String(req.body?.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'Informe um cupom.' })
  try {
    const { data, error } = await getSupabaseServer().from('coupons').select('code,discount_percent,expires_at,usage_limit,used_count').eq('code', code).eq('active', true).maybeSingle()
    if (error) throw error
    if (!data || (data.expires_at && new Date(data.expires_at) < new Date()) || (data.usage_limit !== null && data.used_count >= data.usage_limit)) return res.status(404).json({ error: 'Cupom inválido, expirado ou esgotado.' })
    return res.status(200).json({ code: data.code, discountPercent: Number(data.discount_percent) })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível validar o cupom.' }) }
}
