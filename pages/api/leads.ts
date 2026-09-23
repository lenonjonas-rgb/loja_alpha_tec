import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { isAdmin } from '../../lib/admin-auth'

type LeadStatus = 'new' | 'contacted' | 'proposal' | 'won' | 'lost'
export const config = { api: { bodyParser: { sizeLimit: '30mb' } } }

async function persistMedia(media: { name?: string; type?: string; data?: string }[], id: string) {
  const supabase = getSupabaseServer()
  const bucket = 'lead-media'
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined)
  const urls: { name: string; type: string; url: string }[] = []
  for (const item of media.slice(0, 10)) {
    const match = item.data?.match(/^data:((?:image|video)\/[a-z0-9.+-]+);base64,(.+)$/i)
    if (!match) continue
    const extension = (match[1].split('/')[1] || 'bin').replace('quicktime', 'mov')
    const path = `${id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(match[2], 'base64'), { contentType: match[1], upsert: false })
    if (error) throw error
    urls.push({ name: item.name || path, type: match[1], url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` })
  }
  return urls
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const supabase = getSupabaseServer()
    if (req.method === 'POST') {
      const { name, email, phone, document, cep, street, number, complement, neighborhood, city, state, serviceType, details, equipment, media, estimatedTotal } = req.body || {}
      if (!name || !email || !phone || !cep || !serviceType || !details) return res.status(400).json({ error: 'Preencha os dados obrigatórios para registrar a solicitação.' })
      const leadId = crypto.randomUUID()
      const mediaUrls = Array.isArray(media) ? await persistMedia(media, leadId) : []
      const { data, error } = await supabase.from('leads').insert({ id: leadId, name, email, phone, document: document || null, cep, street: street || '', number: number || '', complement: complement || null, neighborhood: neighborhood || '', city: city || '', state: state || '', service_type: serviceType, details, equipment: Array.isArray(equipment) ? equipment : [], media: mediaUrls, estimated_total: Number(estimatedTotal) || 0, status: 'new' }).select('id').single()
      if (error) throw error
      return res.status(201).json({ leadId: data.id })
    }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
    if (req.method === 'DELETE') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Lead é obrigatório.' })
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
      return res.status(200).json({ id })
    }
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
