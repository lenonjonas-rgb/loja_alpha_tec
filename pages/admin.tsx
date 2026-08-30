import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminBulkProducts from '../components/AdminBulkProducts'
import AdminLeads from '../components/AdminLeads'
import AdminOrders from '../components/AdminOrders'
import AdminProducts from '../components/AdminProducts'
import AdminCouponsPage from './admin/coupons'

type Product = { id: string; name: string; brand: string; category: string; compatibleEquipment: string; description: string; image: string; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean }
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [tab, setTab] = useState<'leads' | 'orders' | 'products' | 'bulk' | 'coupons'>('leads')
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => { fetch('/api/admin/session').then((response) => response.json()).then((result) => { setAuthenticated(result.authenticated) }).finally(() => setCheckingSession(false)) }, [])
  useEffect(() => { if (authenticated) void loadProducts() }, [authenticated])
  async function loadProducts() { const response = await fetch('/api/products'); if (response.ok) setProducts(await response.json()) }
  async function signIn(event: FormEvent) { event.preventDefault(); const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) }); if (!response.ok) return setMessage('Usuário ou senha inválidos.'); setAuthenticated(true) }
  if (checkingSession) return <section className="admin-page container"><p className="form-hint">Carregando central administrativa...</p></section>
  if (!authenticated) return <section className="admin-page container"><Link href="/" className="back-link">← Voltar para a loja</Link><div className="admin-login"><p className="eyebrow">ÁREA RESTRITA</p><h1>Painel Master</h1><p>Controle leads, pedidos e catálogo em um só lugar.</p><form onSubmit={signIn}><label>Usuário<input required value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label><label>Senha<input required type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit">Entrar <span>→</span></button></form></div></section>
return <section className="admin-page container"><div className="admin-heading"><div><p className="eyebrow">ÁREA MASTER</p><h1>Central de atendimento</h1></div><Link href="/" className="outline-button">Voltar à loja</Link></div><nav className="admin-tabs"><button className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>Leads</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Pedidos</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Produtos</button><button className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>Cadastro</button><button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>Cupons</button></nav>{tab === 'leads' && <AdminLeads onMessage={setMessage} />}{tab === 'orders' && <AdminOrders onMessage={setMessage} />}{tab === 'products' && <AdminProducts products={products} onSaved={(updated) => setProducts((items) => items.map((item) => item.id === updated.id ? updated : item))} onMessage={setMessage} />}{tab === 'bulk' && <AdminBulkProducts onMessage={setMessage} />}{tab === 'coupons' && <AdminCouponsPage />}{message && <p className="form-status success">{message}</p>}</section>
}
