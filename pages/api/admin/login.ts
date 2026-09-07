import type { NextApiRequest, NextApiResponse } from 'next'
import { adminLogin } from '../../../lib/admin-auth'

export default function handler(req: NextApiRequest, res: NextApiResponse<{ authenticated?: boolean; error?: string }>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  return adminLogin(req, res)
}
