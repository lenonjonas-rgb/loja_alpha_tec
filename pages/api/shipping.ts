import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = { price?: number; deadline?: string; error?: string }
export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const cep = String(req.query.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return res.status(400).json({ error: 'Informe um CEP válido.' })
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const address = await response.json()
    if (address.erro) return res.status(404).json({ error: 'CEP não encontrado.' })
    const isSantaCatarina = address.uf === 'SC'
    return res.status(200).json({ price: isSantaCatarina ? 24.9 : 39.9, deadline: isSantaCatarina ? '3 a 5 dias úteis' : '5 a 10 dias úteis' })
  } catch { return res.status(502).json({ error: 'Não foi possível calcular o frete agora.' }) }
}
