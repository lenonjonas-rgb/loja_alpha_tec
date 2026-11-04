import { createHmac, timingSafeEqual } from 'crypto'

export type CorreiosDelivery = { tracking_code: string; delivered_at: string }
const deliveryEvents = new Set(['BDE-1', 'BDI-1', 'BDR-1'])

export function verifyCorreiosSignature(body: Buffer, signature: string, secret: string) {
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCorreiosDeliveries(payload: unknown, eventType: string): CorreiosDelivery[] {
  if (!deliveryEvents.has(eventType)) return []
  const objects = Array.isArray(payload) ? payload : record(payload) && Array.isArray(payload.objetos) ? payload.objetos : null
  if (!objects?.length) throw new Error('Lista de objetos dos Correios inválida.')
  const deliveries = new Map<string, CorreiosDelivery>()
  for (const object of objects) {
    if (!record(object) || typeof object.codObjeto !== 'string' || !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(object.codObjeto)) {
      throw new Error('Código de rastreio inválido no evento dos Correios.')
    }
    if (!Array.isArray(object.eventos) || !object.eventos.length) throw new Error('Eventos do objeto ausentes.')
    let matched = false
    for (const event of object.eventos) {
      if (!record(event) || typeof event.codigo !== 'string' || typeof event.tipo !== 'string') throw new Error('Evento de rastreio inválido.')
      if (`${event.codigo}-${Number(event.tipo)}` !== eventType) continue
      if (typeof event.dtHrCriado !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(event.dtHrCriado)) {
        throw new Error('Data de entrega inválida.')
      }
      // Datas do SRO sem offset são horários locais do Brasil, não do servidor.
      const date = new Date(/[Z]|[+-]\d{2}:\d{2}$/.test(event.dtHrCriado) ? event.dtHrCriado : `${event.dtHrCriado}-03:00`)
      if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 5 * 60_000) throw new Error('Data de entrega inválida.')
      const delivery = { tracking_code: object.codObjeto, delivered_at: date.toISOString() }
      matched = true
      const previous = deliveries.get(object.codObjeto)
      if (!previous || delivery.delivered_at < previous.delivered_at) deliveries.set(object.codObjeto, delivery)
    }
    if (!matched) throw new Error('Evento de entrega não corresponde ao tipo recebido.')
  }
  return [...deliveries.values()]
}
