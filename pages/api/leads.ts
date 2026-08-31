import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

type LeadStatus = 'new' | 'contacted' | 'proposal' | 'won' | 'lost'

function isAdmin(req: NextApiRequest) {
  const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.')
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const supabase = getSupabaseServer()
    if (req.method === 'POST') {
      const { name, email, phone, document, cep, street, number, complement, neighborhood, city, state, serviceType, details, equipment, estimatedTotal } = req.body || {}
      if (!name || !email || !phone || !cep || !serviceType || !details) return res.status(400).json({ error: 'Preencha os dados obrigatórios para registrar a solicitação.' })
      const { data, error } = await supabase.from('leads').insert({ name, email, phone, document: document || null, cep, street: street || '', number: number || '', complement: complement || null, neighborhood: neighborhood || '', city: city || '', state: state || '', service_type: serviceType, details, equipment: Array.isArray(equipment) ? equipment : [], estimated_total: Number(estimatedTotal) || 0, status: 'new' }).select('id').single()
      if (error) throw error
      return res.status(201).json({ leadId: data.id })
    }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
    if (req.method === 'GET') {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('leads')
        .update({ status: 'lost', updated_at: new Date().toISOString() })
        .eq('status', 'new')
        .lt('updated_at', twoDaysAgo)

      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json(data)
    }
    const { id, status, notes } = req.body || {}
    if (!id || !['new', 'contacted', 'proposal', 'won', 'lost'].includes(status)) return res.status(400).json({ error: 'Lead e status são obrigatórios.' })
    const { data, error } = await supabase.from('leads').update({ status: status as LeadStatus, notes: typeof notes === 'string' ? notes : '', updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
    if (error) throw error
    return res.status(200).json(data)
  } catch (error) {
    console.error('Erro na API de leads:', error)
    return res.status(500).json({ error: 'Não foi possível acessar os leads. Verifique se a tabela leads foi criada no Supabase.' })
  }
}
