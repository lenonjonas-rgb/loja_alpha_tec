import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../../lib/supabase-server'

type ProductInput = { id?: string; name: string; brand?: string; category: string; compatibleEquipment?: string; description: string; image: string; price: number; active: boolean }
function isAdmin(req: NextApiRequest) { const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.'); const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(username || '').digest('hex'); return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) }
function toRow(product: ProductInput) { return { name: product.name, brand: product.brand || null, category: product.category, compatible_equipment: product.compatibleEquipment || null, description: product.description, image_url: product.image, price: product.price, active: product.active } }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = getSupabaseServer()
    if (req.method === 'GET') { const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false }); if (error) throw error; return res.status(200).json(data.map((row) => ({ id: row.id, name: row.name, brand: row.brand, category: row.category, compatibleEquipment: row.compatible_equipment, description: row.description, image: row.image_url, price: Number(row.price), active: row.active }))) }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
    if (req.method === 'POST') { const { data, error } = await supabase.from('products').insert(toRow(req.body)).select().single(); if (error) throw error; return res.status(201).json(data) }
    if (req.method === 'PUT') { const product = req.body as ProductInput; if (!product.id) return res.status(400).json({ error: 'ID do produto obrigatório.' }); const { data, error } = await supabase.from('products').update(toRow(product)).eq('id', product.id).select().single(); if (error) throw error; return res.status(200).json(data) }
    if (req.method === 'DELETE') { const { error } = await supabase.from('products').delete().eq('id', req.query.id); if (error) throw error; return res.status(204).end() }
    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao acessar produtos.' }) }
}
