import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = { address?: Record<string, string>; error?: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const cep = String(req.query.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return res.status(400).json({ error: 'Informe um CEP válido.' })

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const data = await response.json()
    if (data.erro) return res.status(404).json({ error: 'CEP não encontrado.' })
    return res.status(200).json({ address: data })
  } catch {
    return res.status(502).json({ error: 'Não foi possível consultar o CEP agora.' })
  }
}
