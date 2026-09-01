import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { pointsToDiscount } from '../../lib/loyalty'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })

  try {
    const supabase = getSupabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

    const { data: balance, error: balanceError } = await supabase.rpc('get_loyalty_balance', { p_customer_id: user.id })
    if (balanceError) throw balanceError

    const points = Number(balance || 0)
    return res.status(200).json({ points, discountValue: pointsToDiscount(points) })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar seus pontos.' })
  }
}
