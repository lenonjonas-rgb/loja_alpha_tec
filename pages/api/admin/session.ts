import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse<{ authenticated: boolean }>) {
  const raw = req.cookies.alpha_admin_session || ''
  const [username, rawSignature] = raw.split('.')
  const providedSignature = rawSignature || ''
  const expectedSignature = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  const validSignature = providedSignature.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
  return res.status(200).json({ authenticated: Boolean(username && providedSignature && validSignature && username === process.env.ALPHA_MASTER_USER) })
}
