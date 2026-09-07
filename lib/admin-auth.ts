import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

const cookieName = 'alpha_admin_session'
const sessionMaxAge = 8 * 60 * 60
const failedLogins = new Map<string, { count: number; blockedUntil: number }>()
const maxFailures = 5
const blockDurationMs = 15 * 60 * 1000

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) return null
  return secret
}

function sign(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

export function isAdmin(req: NextApiRequest) {
  const secret = getSecret()
  const expectedUser = process.env.ALPHA_MASTER_USER
  if (!secret || !expectedUser) return false

  const [encodedUser, expiresAtText, providedSignature] = String(req.cookies[cookieName] || '').split('.')
  const username = encodedUser ? Buffer.from(encodedUser, 'base64url').toString('utf8') : ''
  const expiresAt = Number(expiresAtText)
  if (!username || username !== expectedUser || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !providedSignature) return false

  const payload = `${encodedUser}.${expiresAtText}`
  const expectedSignature = sign(payload, secret)
  return providedSignature.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
}

export function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  if (isAdmin(req)) return true
  res.status(401).json({ error: 'Não autorizado.' })
  return false
}

export function adminLogin(req: NextApiRequest, res: NextApiResponse) {
  const secret = getSecret()
  const expectedUser = process.env.ALPHA_MASTER_USER
  const expectedPassword = process.env.ALPHA_MASTER_PASSWORD
  if (!secret || !expectedUser || !expectedPassword) return res.status(503).json({ error: 'Autenticação administrativa não configurada.' })

  const username = String(req.body?.username || '')
  const password = String(req.body?.password || '')
  const address = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
  const key = `${address}:${username.toLowerCase()}`
  const attempt = failedLogins.get(key)
  if (attempt?.blockedUntil && attempt.blockedUntil > Date.now()) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' })
  const userMatches = username.length === expectedUser.length && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser))
  const passwordMatches = password.length === expectedPassword.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword))
  if (!userMatches || !passwordMatches) {
    const count = (attempt?.count || 0) + 1
    failedLogins.set(key, { count, blockedUntil: count >= maxFailures ? Date.now() + blockDurationMs : 0 })
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' })
  }

  failedLogins.delete(key)

  const encodedUser = Buffer.from(username).toString('base64url')
  const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAge
  const payload = `${encodedUser}.${expiresAt}`
  const value = `${payload}.${sign(payload, secret)}`
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionMaxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  return res.status(200).json({ authenticated: true })
}

