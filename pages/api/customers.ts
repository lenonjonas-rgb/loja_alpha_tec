import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const customer = req.body || {}
  if (!customer.name || !customer.email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' })
  try {
    const supabase = getSupabaseServer()
    const { data, error } = await supabase.from('customers').upsert({ name: customer.name, document: customer.document || null, email: customer.email, phone: customer.phone || null }, { onConflict: 'email' }).select('id,name,document,email,phone').single()
    if (error) throw error
    return res.status(200).json(data)
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível salvar o cliente.' }) }
}
