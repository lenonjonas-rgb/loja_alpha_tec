import type { NextApiRequest, NextApiResponse } from 'next'
import { isAdmin } from '../../../lib/admin-auth'

export default function handler(req: NextApiRequest, res: NextApiResponse<{ authenticated: boolean }>) {
  return res.status(200).json({ authenticated: isAdmin(req) })
}
