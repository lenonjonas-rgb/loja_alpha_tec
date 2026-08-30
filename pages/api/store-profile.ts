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

  try {
    if (req.method === 'GET' && req.query.cnpj) {
      const cnpj = String(req.query.cnpj).replace(/\D/g, '')
      if (cnpj.length !== 14) return res.status(400).json({ error: 'Informe um CNPJ com 14 números.' })
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      const company = await response.json()
      if (!response.ok) return res.status(response.status).json({ error: company.message || 'CNPJ não encontrado.' })
      return res.status(200).json({ cnpj, legalName: company.razao_social || '', tradeName: company.nome_fantasia || '', email: company.email || '', phone: company.ddd_telefone_1 || '', cep: company.cep || '', street: company.logradouro || '', number: company.numero || '', neighborhood: company.bairro || '', city: company.municipio || '', state: company.uf || '' })
    }

    const supabase = getSupabaseServer()
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('store_profiles').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const profile = req.body || {}
      if (!profile.cnpj || !profile.legalName || !profile.cep || !profile.street || !profile.number || !profile.city || !profile.state) return res.status(400).json({ error: 'Preencha os campos obrigatórios da loja.' })
      const { data, error } = await supabase.from('store_profiles').upsert({ id: 1, cnpj: String(profile.cnpj).replace(/\D/g, ''), legal_name: profile.legalName, trade_name: profile.tradeName || null, email: profile.email || null, phone: profile.phone || null, cep: String(profile.cep).replace(/\D/g, ''), street: profile.street, number: profile.number, neighborhood: profile.neighborhood || null, city: profile.city, state: String(profile.state).toUpperCase() }, { onConflict: 'id' }).select('*').single()
      if (error) throw error
      return res.status(200).json({ cnpj: data.cnpj, legalName: data.legal_name, tradeName: data.trade_name || '', email: data.email || '', phone: data.phone || '', cep: data.cep, street: data.street, number: data.number, neighborhood: data.neighborhood || '', city: data.city, state: data.state })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível gerenciar o cadastro da loja.' })
  }
}