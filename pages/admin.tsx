import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import AdminBulkProducts from '../components/AdminBulkProducts'
import AdminDashboard from '../components/AdminDashboard'
import AdminLeads from '../components/AdminLeads'
import AdminOrders from '../components/AdminOrders'
import AdminProducts from '../components/AdminProducts'
import AdminPromotions from '../components/AdminPromotions'
import AdminQuestions from '../components/AdminQuestions'
import AdminStoreProfile from '../components/AdminStoreProfile'
import AdminUsers from '../components/AdminUsers'
import AdminCouponsPage from './admin/coupons'
import AdminPushSetup from '../components/AdminPushSetup'
import { ROLE_LABELS, ROLE_TABS, type AdminRole, type AdminTab } from '../lib/admin-roles'

type Product = { id: string; name: string; internalCode?: string; displayOrder?: number; brand: string; category: string; compatibleEquipment: string; description: string; specifications: string; image: string; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean; showInFeatured: boolean; weightKg?: number; heightCm?: number; widthCm?: number; lengthCm?: number }

const tabItems: { key: AdminTab; label: string }[] = [
  { key: 'orders', label: 'Pedidos' },
  { key: 'dashboard', label: 'Visão geral' },
  { key: 'leads', label: 'Leads' },
  { key: 'products', label: 'Produtos' },
  { key: 'bulk', label: 'Cadastro' },
  { key: 'promotions', label: 'Posts promocionais' },
  { key: 'coupons', label: 'Cupons' },
  { key: 'questions', label: 'Perguntas' },
  { key: 'store', label: 'Loja' },
  { key: 'users', label: 'Usuários' },
]

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [role, setRole] = useState<AdminRole | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [tab, setTab] = useState<AdminTab>('orders')
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const allowedTabs = useMemo(() => (role ? ROLE_TABS[role] : []), [role])
  useEffect(() => {
    fetch('/api/admin/session')
      .then((response) => response.json())
      .then((result) => { setAuthenticated(result.authenticated); setRole(result.role); setUsername(result.username) })
      .finally(() => setCheckingSession(false))
  }, [])
  useEffect(() => { if (authenticated) void loadProducts() }, [authenticated])
  useEffect(() => {
    if (role && !allowedTabs.includes(tab)) setTab(allowedTabs[0] || 'orders')
  }, [role, allowedTabs, tab])
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
      if (!document.fullscreenElement) {
        if (role === 'kiosk') { void handleLogout(); return }
        setTab((current) => (current === 'dashboard' ? 'orders' : current))
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void }
        orientation?.unlock?.()
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [role])
  async function loadProducts() { const response = await fetch('/api/products?admin=1'); if (response.ok) setProducts(await response.json()) }
  async function openDashboard() {
    setTab('dashboard')
    await contentRef.current?.requestFullscreen?.()
    const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }
    orientation?.lock?.('landscape')?.catch(() => undefined)
  }
  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
    setAuthenticated(false)
    setRole(null)
    setUsername(null)
    setTab('orders')
  }
  async function signIn(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) })
    if (!response.ok) return setMessage('Usuário ou senha inválidos.')
    const session = await fetch('/api/admin/session').then((sessionResponse) => sessionResponse.json())
    setAuthenticated(session.authenticated)
    setRole(session.role)
    setUsername(session.username)
    if (session.role === 'kiosk') void openDashboard()
  }
  if (checkingSession) return <section className="admin-page container"><p className="form-hint">Carregando central administrativa...</p></section>
  if (!authenticated) return <section className="admin-page container"><Link href="/" className="back-link">← Voltar para a loja</Link><div className="admin-login"><p className="eyebrow">ÁREA RESTRITA</p><h1>Painel Master</h1><p>Controle leads, pedidos e catálogo em um só lugar.</p><form onSubmit={signIn}><label>Usuário<input required value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label><label>Senha<input required type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit">Entrar <span>→</span></button></form></div></section>

  if (role === 'kiosk') {
    return (
      <section className="admin-page container kiosk-mode">
        <div className="admin-tab-content" ref={contentRef}>
          {isFullscreen ? <AdminDashboard /> : (
            <div className="kiosk-start">
              <p className="eyebrow">MODO TV · Nível 0</p>
              <h1>Visão geral</h1>
              <p className="form-hint">Clique para abrir em tela cheia. A sessão fica sempre logada; aperte Esc para encerrar.</p>
              <button className="primary-button" type="button" onClick={openDashboard}>Entrar em tela cheia <span>→</span></button>
              <button className="outline-button" type="button" onClick={() => void handleLogout()} style={{ marginTop: 14 }}>Sair</button>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page container">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">ÁREA MASTER{role ? ` · ${ROLE_LABELS[role]}` : ''}</p>
          <h1>Central de atendimento{username ? ` · ${username}` : ''}</h1>
        </div>
        <div className="admin-heading-actions">
          <AdminPushSetup />
          <button className="outline-button" type="button" onClick={() => void handleLogout()}>Sair</button>
          <Link href="/" className="outline-button">Voltar à loja</Link>
        </div>
      </div>

      <nav className="admin-tabs">
        {tabItems.filter((item) => allowedTabs.includes(item.key)).map((item) => (
          <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={item.key === 'dashboard' ? openDashboard : () => setTab(item.key)}>{item.label}</button>
        ))}
      </nav>

      <div className="admin-tab-content" ref={contentRef}>
        {tab === 'orders' && <AdminOrders products={products} onMessage={setMessage} />}
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'leads' && <AdminLeads onMessage={setMessage} />}
        {tab === 'products' && <AdminProducts products={products} onSaved={(updated) => setProducts((items) => items.map((item) => item.id === updated.id ? updated : item))} onReordered={(ordered) => setProducts(ordered)} onMessage={setMessage} />}
        {tab === 'bulk' && <AdminBulkProducts onMessage={setMessage} />}
        {tab === 'promotions' && <AdminPromotions products={products} onMessage={setMessage} />}
        {tab === 'coupons' && <AdminCouponsPage />}
        {tab === 'questions' && <AdminQuestions onMessage={setMessage} />}
        {tab === 'store' && <AdminStoreProfile />}
        {tab === 'users' && <AdminUsers onMessage={setMessage} />}
        {message && <p className="form-status success">{message}</p>}
      </div>
    </section>
  )
}
