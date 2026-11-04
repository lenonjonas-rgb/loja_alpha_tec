import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const origin = String(req.headers.origin || '')
  const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase()
  let originHost = ''
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return res.status(403).json({ error: 'Origem não permitida.' })
  }
  if (!requestHost || originHost !== requestHost) return res.status(403).json({ error: 'Origem não permitida.' })

  return res.status(202).json({ notified: false, reason: 'O aviso é agendado após 3 horas no carrinho da conta.' })
}