import { FormEvent, useEffect, useState } from 'react'
import { ROLE_LABELS, type AdminRole } from '../lib/admin-roles'

type AdminUser = { id: string; username: string; role: AdminRole; active: boolean; createdAt: string }
type Props = { onMessage: (message: string) => void }

const roleOptions: AdminRole[] = ['kiosk', 'logistica', 'administrativo', 'master']

export default function AdminUsers({ onMessage }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [form, setForm] = useState({ username: '', password: '', role: 'logistica' as AdminRole })
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})

  function loadUsers() {
    fetch('/api/admin/users')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setUsers)
      .catch(() => onMessage('Não foi possível carregar os usuários.'))
  }

  useEffect(() => { loadUsers() }, [])

  async function createUser(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível criar o usuário.')
    setUsers((items) => [result, ...items])
    setForm({ username: '', password: '', role: 'logistica' })
    onMessage('Usuário criado com sucesso.')
  }

  async function updateUser(user: AdminUser, patch: { role?: AdminRole; active?: boolean; password?: string }) {
    const response = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, ...patch }),
    })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível atualizar o usuário.')
    setUsers((items) => items.map((item) => (item.id === result.id ? result : item)))
    onMessage('Usuário atualizado.')
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Excluir o usuário ${user.username}? Essa ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível excluir o usuário.')
    setUsers((items) => items.filter((item) => item.id !== user.id))
    onMessage('Usuário excluído.')
  }

  function applyPasswordReset(user: AdminUser) {
    const password = (resetPasswords[user.id] || '').trim()
    if (password.length < 8) return onMessage('A nova senha deve ter pelo menos 8 caracteres.')
    void updateUser(user, { password })
    setResetPasswords((current) => ({ ...current, [user.id]: '' }))
  }

  return (
    <div>
      <form className="admin-form" onSubmit={createUser}>
        <h2>Novo usuário</h2>
        <div className="form-grid">
          <label>Usuário<input required minLength={3} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="ex.: joao.logistica" /></label>
          <label>Senha<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="mínimo 8 caracteres" /></label>
          <label>Nível de acesso<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}>{roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        </div>
        <p className="form-hint">Nível 0 (TV/Kiosk): mostra só a Visão geral em tela cheia e fica logado permanentemente até apertar Esc. Nível 1 (Logística): pedidos e leads. Nível 2 (Administrativo): tudo do nível 1 + produtos, cupons e posts promocionais. Nível 3 (Master): acesso total, incluindo gestão de usuários.</p>
        <button className="primary-button" type="submit">Criar usuário <span>→</span></button>
      </form>

      <div className="admin-list">
        <h2>Usuários cadastrados</h2>
        <p className="form-hint">O usuário master original (variável ALPHA_MASTER_USER) não aparece nesta lista e continua com nível 3 fixo.</p>
        {!users.length && <p className="form-hint">Nenhum usuário cadastrado ainda.</p>}
        {users.map((user) => (
          <div className="admin-item" key={user.id}>
            <span>
              <strong>{user.username}</strong>
              <small>{ROLE_LABELS[user.role]} · {user.active ? 'Ativo' : 'Inativo'} · Criado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</small>
            </span>
            <select value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as AdminRole })}>
              {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
            <label className="active-toggle">
              <input type="checkbox" checked={user.active} onChange={(event) => void updateUser(user, { active: event.target.checked })} /> Ativo
            </label>
            <input
              type="password"
              placeholder="Nova senha"
              value={resetPasswords[user.id] || ''}
              onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))}
            />
            <button type="button" onClick={() => applyPasswordReset(user)}>Redefinir senha</button>
            <button type="button" onClick={() => void deleteUser(user)}>Excluir</button>
          </div>
        ))}
      </div>
    </div>
  )
}
