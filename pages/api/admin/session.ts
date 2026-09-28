import type { NextApiRequest, NextApiResponse } from 'next'
import { getAdminSession } from '../../../lib/admin-auth'

type SessionResponse = { authenticated: boolean; username: string | null; role: string | null }

export default function handler(req: NextApiRequest, res: NextApiResponse<SessionResponse>) {
  const session = getAdminSession(req)
  return res.status(200).json({ authenticated: Boolean(session), username: session?.username || null, role: session?.role || null })
}
