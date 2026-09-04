import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  const password = String(req.body?.password || '')
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Informe o e-mail e o código de 6 dígitos.' })
  if (password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' })

  try {
    const supabase = getSupabaseServer()
    const { data: resetCode, error: codeError } = await supabase
      .from('password_reset_codes')
      .select('id,customer_id,code_hash,expires_at,attempts,used_at')
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (codeError) throw codeError
    if (!resetCode || resetCode.attempts >= 5 || new Date(resetCode.expires_at) < new Date()) return res.status(400).json({ error: 'Código inválido, expirado ou bloqueado. Solicite um novo código.' })

    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    if (codeHash !== resetCode.code_hash) {
      await supabase.from('password_reset_codes').update({ attempts: resetCode.attempts + 1 }).eq('id', resetCode.id)
      return res.status(400).json({ error: 'Código inválido. Confira o e-mail e tente novamente.' })
    }

    const { error: passwordError } = await supabase.auth.admin.updateUserById(resetCode.customer_id, { password })
    if (passwordError) throw passwordError
    const { error: usedError } = await supabase.from('password_reset_codes').update({ used_at: new Date().toISOString() }).eq('id', resetCode.id)
    if (usedError) throw usedError

    return res.status(200).json({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' })
  } catch {
    return res.status(500).json({ error: 'Não foi possível redefinir a senha agora. Tente novamente.' })
  }
}
