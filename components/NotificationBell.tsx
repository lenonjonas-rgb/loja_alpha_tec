import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

type Notification = { id: string; order_id: string | null; title: string; message: string; read_at: string | null; created_at: string }

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return setNotifications([])
    const response = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) setNotifications(await response.json())
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 30000)
    return () => clearInterval(interval)
  }, [])

  async function markRead(id?: string) {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(id ? { id } : {}) })
    setNotifications((items) => id ? items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item) : items.map((item) => ({ ...item, read_at: new Date().toISOString() })))
  }

  const unreadCount = notifications.filter((item) => !item.read_at).length
  return <div className="notification-area"><button type="button" className="notification-bell" aria-label="Notificações" onClick={() => setOpen((value) => !value)}><span className="bell-icon" aria-hidden="true" />{unreadCount > 0 && <b>{unreadCount > 9 ? '9+' : unreadCount}</b>}</button>{open && <div className="notification-panel"><div className="notification-panel-heading"><strong>Notificações</strong>{unreadCount > 0 && <button type="button" onClick={() => void markRead()}>Marcar como lidas</button>}</div>{notifications.length === 0 ? <p className="notification-empty">Nenhuma novidade por enquanto.</p> : notifications.map((item) => <article className={item.read_at ? 'notification-item' : 'notification-item unread'} key={item.id}><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>{item.order_id && <Link href="/account" onClick={() => void markRead(item.id)}>Ver pedido</Link>}</article>)}</div>}</div>
}
