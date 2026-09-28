import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AdminBulkProducts from '../components/AdminBulkProducts'
import AdminDashboard from '../components/AdminDashboard'
import AdminLeads from '../components/AdminLeads'
import AdminOrders from '../components/AdminOrders'
import AdminProducts from '../components/AdminProducts'
import AdminPromotions from '../components/AdminPromotions'
import AdminQuestions from '../components/AdminQuestions'
import AdminStoreProfile from '../components/AdminStoreProfile'
import AdminCouponsPage from './admin/coupons'
import AdminPushSetup from '../components/AdminPushSetup'

type Product = { id: string; name: string; internalCode?: string; displayOrder?: number; brand: string; category: string; compatibleEquipment: string; description: string; specifications: string; image: string; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean; showInFeatured: boolean; weightKg?: number; heightCm?: number; widthCm?: number; lengthCm?: number }
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [tab, setTab] = useState<'orders' | 'dashboard' | 'leads' | 'products' | 'bulk' | 'coupons' | 'questions' | 'store' | 'promotions'>('orders')
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => { fetch('/api/admin/session').then((response) => response.json()).then((result) => { setAuthenticated(result.authenticated) }).finally(() => setCheckingSession(false)) }, [])
  useEffect(() => { if (authenticated) void loadProducts() }, [authenticated])
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setTab((current) => (current === 'dashboard' ? 'orders' : current))
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void }
        orientation?.unlock?.()
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])
  async function loadProducts() { const response = await fetch('/api/products?admin=1'); if (response.ok) setProducts(await response.json()) }
  async function openDashboard() {
    setTab('dashboard')
    await contentRef.current?.requestFullscreen?.()
    const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }
    orientation?.lock?.('landscape')?.catch(() => undefined)
  }
  async function signIn(event: FormEvent) { event.preventDefault(); const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) }); if (!response.ok) return setMessage('Usuário ou senha inválidos.'); setAuthenticated(true) }
  if (checkingSession) return <section className="admin-page container"><p className="form-hint">Carregando central administrativa...</p></section>
  if (!authenticated) return <section className="admin-page container"><Link href="/" className="back-link">← Voltar para a loja</Link><div className="admin-login"><p className="eyebrow">ÁREA RESTRITA</p><h1>Painel Master</h1><p>Controle leads, pedidos e catálogo em um só lugar.</p><form onSubmit={signIn}><label>Usuário<input required value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label><label>Senha<input required type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit">Entrar <span>→</span></button></form></div></section>
return <section className="admin-page container"><div className="admin-heading"><div><p className="eyebrow">ÁREA MASTER</p><h1>Central de atendimento</h1></div><div className="admin-heading-actions"><AdminPushSetup /><Link href="/" className="outline-button">Voltar à loja</Link></div></div><nav className="admin-tabs"><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Pedidos</button><button className={tab === 'dashboard' ? 'active' : ''} onClick={openDashboard}>Visão geral</button><button className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>Leads</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Produtos</button><button className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>Cadastro</button><button className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}>Posts promocionais</button><button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>Cupons</button><button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>Perguntas</button><button className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>Loja</button></nav><div className="admin-tab-content" ref={contentRef}>{tab === 'orders' && <AdminOrders onMessage={setMessage} />}{tab === 'dashboard' && <AdminDashboard />}{tab === 'leads' && <AdminLeads onMessage={setMessage} />}{tab === 'products' && <AdminProducts products={products} onSaved={(updated) => setProducts((items) => items.map((item) => item.id === updated.id ? updated : item))} onReordered={(ordered) => setProducts(ordered)} onMessage={setMessage} />}{tab === 'bulk' && <AdminBulkProducts onMessage={setMessage} />}{tab === 'promotions' && <AdminPromotions products={products} onMessage={setMessage} />}{tab === 'coupons' && <AdminCouponsPage />}{tab === 'questions' && <AdminQuestions onMessage={setMessage} />}{tab === 'store' && <AdminStoreProfile />}{message && <p className="form-status success">{message}</p>}</div></section>
}
