import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from './supabase-server'
import { isAdminRole, type AdminRole } from './admin-roles'

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

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

function verifyPassword(password: string, hash: string, salt: string) {
  try {
    const candidate = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export type AdminSession = { username: string; role: AdminRole }

export function getAdminSession(req: NextApiRequest): AdminSession | null {
  const secret = getSecret()
  if (!secret) return null

  const [encodedUser, role, expiresAtText, providedSignature] = String(req.cookies[cookieName] || '').split('.')
  const username = encodedUser ? Buffer.from(encodedUser, 'base64url').toString('utf8') : ''
  const expiresAt = Number(expiresAtText)
  if (!username || !isAdminRole(role) || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !providedSignature) return null

  const payload = `${encodedUser}.${role}.${expiresAtText}`
  const expectedSignature = sign(payload, secret)
  if (providedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) return null
  return { username, role }
}

export function isAdmin(req: NextApiRequest) {
  return Boolean(getAdminSession(req))
}

export function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  if (isAdmin(req)) return true
  res.status(401).json({ error: 'Não autorizado.' })
  return false
}

export function requireRole(req: NextApiRequest, res: NextApiResponse, allowed: AdminRole[]) {
  const session = getAdminSession(req)
  if (!session) { res.status(401).json({ error: 'Não autorizado.' }); return null }
  if (!allowed.includes(session.role)) { res.status(403).json({ error: 'Seu nível de acesso não permite esta ação.' }); return null }
  return session
}

function issueSessionCookie(res: NextApiResponse, username: string, role: AdminRole, secret: string) {
  const encodedUser = Buffer.from(username).toString('base64url')
  const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAge
  const payload = `${encodedUser}.${role}.${expiresAt}`
  const value = `${payload}.${sign(payload, secret)}`
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionMaxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
}

export async function adminLogin(req: NextApiRequest, res: NextApiResponse) {
  const secret = getSecret()
  if (!secret) return res.status(503).json({ error: 'Autenticação administrativa não configurada.' })

  const username = String(req.body?.username || '')
  const password = String(req.body?.password || '')
  const address = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
  const key = `${address}:${username.toLowerCase()}`
  const attempt = failedLogins.get(key)
  if (attempt?.blockedUntil && attempt.blockedUntil > Date.now()) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' })

  // conta master histórica, configurada via variáveis de ambiente (nível 3)
  const expectedUser = process.env.ALPHA_MASTER_USER
  const expectedPassword = process.env.ALPHA_MASTER_PASSWORD
  const masterMatches = Boolean(expectedUser && expectedPassword && username.length === expectedUser.length && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser)) && password.length === expectedPassword.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword)))

  if (masterMatches && expectedUser) {
    failedLogins.delete(key)
    issueSessionCookie(res, expectedUser, 'master', secret)
    return res.status(200).json({ authenticated: true })
  }

  let matched: AdminSession | null = null
  if (username) {
    try {
      const supabase = getSupabaseServer()
      const { data } = await supabase.from('admin_users').select('username,password_hash,password_salt,role,active').ilike('username', username).maybeSingle()
      if (data && data.active && isAdminRole(data.role) && verifyPassword(password, data.password_hash, data.password_salt)) matched = { username: data.username, role: data.role }
    } catch {
      // tabela admin_users pode ainda não existir; trata como credenciais inválidas
    }
  }

  if (!matched) {
    const count = (attempt?.count || 0) + 1
    failedLogins.set(key, { count, blockedUntil: count >= maxFailures ? Date.now() + blockDurationMs : 0 })
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' })
  }

  failedLogins.delete(key)
  issueSessionCookie(res, matched.username, matched.role, secret)
  return res.status(200).json({ authenticated: true })
}
