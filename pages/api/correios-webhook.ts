import type { NextApiRequest, NextApiResponse } from 'next'
import { parseCorreiosDeliveries, verifyCorreiosSignature } from '../../lib/correios-delivery'
import { getSupabaseServer } from '../../lib/supabase-server'

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const secret = process.env.CORREIOS_WEBHOOK_SECRET
  const contract = process.env.CORREIOS_CONTRATO
  if (!secret || !contract) {
    console.error('Webhook dos Correios não configurado.')
    return res.status(503).end()
  }
  try {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > 1024 * 1024) return res.status(413).end()
      chunks.push(buffer)
    }
    const raw = Buffer.concat(chunks)
    const signature = req.headers['x-correios-signature']
    if (typeof signature !== 'string' || !verifyCorreiosSignature(raw, signature, secret)) return res.status(401).end()
    if (req.headers['x-correios-hook-id'] !== 'wh-rastro' || req.headers['x-correios-hook-nu-contrato'] !== contract) return res.status(403).end()
    const eventType = req.headers['x-correios-hook-event']
    if (typeof eventType !== 'string') return res.status(400).end()
    let deliveries
    try {
      deliveries = parseCorreiosDeliveries(JSON.parse(raw.toString('utf8')), eventType)
    } catch (error) {
      console.error('Payload de entrega dos Correios inválido:', error instanceof Error ? error.message : 'Formato inválido.')
      // 5xx preserva as retentativas dos Correios para formatos ainda não reconhecidos.
      return res.status(500).end()
    }
    if (deliveries.length) {
      const { error } = await getSupabaseServer().rpc('apply_correios_deliveries', { deliveries })
      if (error) throw error
    }
    return res.status(200).end()
  } catch {
    console.error('Falha ao processar entrega dos Correios.')
    return res.status(500).end()
  }
}
