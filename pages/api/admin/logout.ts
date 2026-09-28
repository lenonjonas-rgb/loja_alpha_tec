import type { NextApiRequest, NextApiResponse } from 'next'
import { clearAdminSession } from '../../../lib/admin-auth'

export default function handler(req: NextApiRequest, res: NextApiResponse<{ authenticated: boolean }>) {
  if (req.method !== 'POST') return res.status(405).json({ authenticated: false })
  clearAdminSession(res)
  return res.status(200).json({ authenticated: false })
}
