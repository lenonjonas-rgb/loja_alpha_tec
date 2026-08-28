import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../../lib/supabase-server'

type ProductInput = { id?: string; name: string; brand?: string; category: string; compatibleEquipment?: string; description: string; image: string; price: number; active: boolean; stock?: number; discountPercent?: number; flashSale?: boolean; showInBanner?: boolean }
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }
function isAdmin(req: NextApiRequest) { const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.'); const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(username || '').digest('hex'); return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) }
function toRow(product: ProductInput) { return { name: product.name, brand: product.brand || null, category: product.category, compatible_equipment: product.compatibleEquipment || null, description: product.description, image_url: product.image, price: product.price, active: product.active, stock: Math.max(0, Number(product.stock) || 0), discount_percent: Math.min(100, Math.max(0, Number(product.discountPercent) || 0)), flash_sale: Boolean(product.flashSale), show_in_banner: Boolean(product.showInBanner) } }
async function persistImage(image: string, id?: string) {
  if (!image.startsWith('data:image/')) return image
  const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) throw new Error('Formato de imagem inválido.')
  const supabase = getSupabaseServer()
  const bucket = 'product-images'
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined)
  const extension = match[1].split('/')[1].replace('jpeg', 'jpg')
  const filePath = `${id || crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, Buffer.from(match[2], 'base64'), { contentType: match[1], upsert: true })
  if (error) throw error
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = getSupabaseServer()
    if (req.method === 'GET') { const { data, error } = await supabase.from('products').select('id,name,brand,category,compatible_equipment,description,image_url,price,active,stock,discount_percent,flash_sale,show_in_banner').order('created_at', { ascending: false }); if (error) throw error; const migrated = await Promise.all(data.map(async (row) => { let image = row.image_url || ''; if (image.startsWith('data:image/')) { try { image = await persistImage(image, row.id); await supabase.from('products').update({ image_url: image }).eq('id', row.id) } catch (migrationError) { console.error('Falha ao migrar imagem do produto:', row.id, migrationError); image = '' } } return { id: row.id, name: row.name, brand: row.brand, category: row.category, compatibleEquipment: row.compatible_equipment, description: row.description, image, price: Number(row.price), active: row.active, stock: Number(row.stock || 0), discountPercent: Number(row.discount_percent || 0), flashSale: Boolean(row.flash_sale), showInBanner: Boolean(row.show_in_banner) } })); return res.status(200).json(migrated) }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
    if (req.method === 'POST') { const product = req.body as ProductInput; const image = await persistImage(product.image); const { data, error } = await supabase.from('products').insert(toRow({ ...product, image })).select().single(); if (error) throw error; return res.status(201).json(data) }
    if (req.method === 'PUT') { const product = req.body as ProductInput; if (!product.id) return res.status(400).json({ error: 'ID do produto obrigatório.' }); const image = await persistImage(product.image, product.id); const { data, error } = await supabase.from('products').update(toRow({ ...product, image })).eq('id', product.id).select().single(); if (error) throw error; return res.status(200).json(data) }
    if (req.method === 'DELETE') { const { error } = await supabase.from('products').delete().eq('id', req.query.id); if (error) throw error; return res.status(204).end() }
    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) { console.error('Erro na API de produtos:', error); return res.status(500).json({ error: 'Não foi possível salvar o produto. Confira as variáveis do Supabase e a tabela products.' }) }
}
