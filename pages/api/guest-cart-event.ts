import type { NextApiRequest, NextApiResponse } from 'next'
import { sendAdminPush } from '../../lib/admin-push'

const notificationCooldownMs = 15 * 60 * 1000
const lastNotificationByIp = new Map<string, number>()

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

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
  const now = Date.now()
  const lastNotification = lastNotificationByIp.get(ip) || 0
  if (now - lastNotification < notificationCooldownMs) return res.status(202).json({ notified: false })

  lastNotificationByIp.set(ip, now)
  if (lastNotificationByIp.size > 5000) {
    for (const [address, timestamp] of lastNotificationByIp) {
      if (now - timestamp >= notificationCooldownMs) lastNotificationByIp.delete(address)
    }
  }

  try {
    await sendAdminPush({ title: 'Novo carrinho', body: 'Um visitante adicionou produtos ao carrinho.' })
    return res.status(202).json({ notified: true })
  } catch (error) {
    lastNotificationByIp.delete(ip)
    console.error('Falha ao notificar um carrinho de visitante:', error)
    return res.status(202).json({ notified: false })
  }
}