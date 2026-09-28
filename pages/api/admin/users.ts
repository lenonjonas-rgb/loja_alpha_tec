import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../../lib/supabase-server'
import { hashPassword, requireRole } from '../../../lib/admin-auth'
import { isAdminRole } from '../../../lib/admin-roles'

function sanitize(row: any) {
  return { id: row.id, username: row.username, role: row.role, active: Boolean(row.active), createdAt: row.created_at }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireRole(req, res, ['master'])
  if (!session) return

  const supabase = getSupabaseServer()
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('admin_users').select('id,username,role,active,created_at').order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json((data || []).map(sanitize))
    }

    if (req.method === 'POST') {
      const { username, password, role } = req.body || {}
      const normalizedUsername = String(username || '').trim()
      if (normalizedUsername.length < 3) return res.status(400).json({ error: 'Informe um usuário com pelo menos 3 caracteres.' })
      if (!isAdminRole(role)) return res.status(400).json({ error: 'Selecione um nível de acesso válido.' })
      if (String(password || '').length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' })
      if (process.env.ALPHA_MASTER_USER && normalizedUsername.toLowerCase() === process.env.ALPHA_MASTER_USER.toLowerCase()) return res.status(409).json({ error: 'Este nome de usuário já está reservado.' })

      const { hash, salt } = hashPassword(String(password))
      const { data, error } = await supabase.from('admin_users').insert({ username: normalizedUsername, password_hash: hash, password_salt: salt, role, active: true }).select('id,username,role,active,created_at').single()
      if (error) {
        if (/duplicate key/i.test(error.message)) return res.status(409).json({ error: 'Já existe um usuário com esse nome.' })
        throw error
      }
      return res.status(201).json(sanitize(data))
    }

    if (req.method === 'PUT') {
      const { id, role, active, password } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Usuário não informado.' })
      const patch: Record<string, unknown> = {}
      if (role !== undefined) {
        if (!isAdminRole(role)) return res.status(400).json({ error: 'Nível de acesso inválido.' })
        patch.role = role
      }
      if (active !== undefined) patch.active = Boolean(active)
      if (password) {
        if (String(password).length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' })
        const { hash, salt } = hashPassword(String(password))
        patch.password_hash = hash
        patch.password_salt = salt
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada para atualizar.' })

      const { data, error } = await supabase.from('admin_users').update(patch).eq('id', id).select('id,username,role,active,created_at').single()
      if (error) throw error
      return res.status(200).json(sanitize(data))
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: 'Usuário não informado.' })
      const { error } = await supabase.from('admin_users').delete().eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || '')
    const missingTable = /admin_users|does not exist|schema cache/i.test(message)
    return res.status(500).json({ error: missingTable ? 'A tabela admin_users ainda não existe. Execute scripts/commerce.sql no Supabase.' : message || 'Não foi possível gerenciar os usuários.' })
  }
}
