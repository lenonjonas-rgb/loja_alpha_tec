import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const customer = req.body || {}
  try {
    const supabase = getSupabaseServer()
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })
    if (req.method === 'GET') { const { data, error } = await supabase.from('customers').select('id,name,document,email,phone').eq('id', user.id).single(); if (error) return res.status(404).json({ error: 'Perfil não encontrado.' }); const { data: address } = await supabase.from('addresses').select('cep,street,number,complement,neighborhood,city,state').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(); return res.status(200).json({ ...data, cep: address?.cep || '', address: address?.street || '', number: address?.number || '', city: address?.city ? `${address.city}/${address.state || ''}` : '' }) }
    if (!customer.name) return res.status(400).json({ error: 'Nome é obrigatório.' })
    const { data, error } = await supabase.from('customers').upsert({ id: user.id, name: customer.name, document: customer.document || null, email: user.email, phone: customer.phone || null }, { onConflict: 'id' }).select('id,name,document,email,phone').single()
    if (error) throw error
    await supabase.from('addresses').delete().eq('customer_id', user.id)
    const [city, state] = String(customer.city || '').split('/')
    const { error: addressError } = await supabase.from('addresses').insert({ customer_id: user.id, cep: customer.cep || '', street: customer.address || '', number: customer.number || '', city: city || '', state: state || '' })
    if (addressError) throw addressError
    return res.status(200).json({ ...data, cep: customer.cep || '', address: customer.address || '', number: customer.number || '', city: customer.city || '' })
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível salvar o cliente.' }) }
}
