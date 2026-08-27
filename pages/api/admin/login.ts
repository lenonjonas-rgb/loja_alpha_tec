import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

const cookieName = 'alpha_admin_session'

function signature(value: string) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(value).digest('hex')
}

export default function handler(req: NextApiRequest, res: NextApiResponse<{ authenticated?: boolean; error?: string }>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const { username, password } = req.body || {}
  if (username !== process.env.ALPHA_MASTER_USER || password !== process.env.ALPHA_MASTER_PASSWORD) return res.status(401).json({ error: 'Usuário ou senha inválidos.' })
  const value = `${username}.${signature(username)}`
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  return res.status(200).json({ authenticated: true })
}
