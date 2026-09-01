import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCarrierTrackingUrl } from '../lib/carrier-tracking'

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type Order = { id: string; created_at: string; status: OrderStatus; payment_status: string; shipping: number; total: number; tracking_code: string | null; carrier: string | null; invoice_url: string | null; order_items: { product_name: string; quantity: number; unit_price: number; total: number }[] }

const labels: Record<OrderStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrders() {
      if (!supabase) {
        setError('Não foi possível carregar seus pedidos agora.')
        setLoading(false)
        return
      }
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setLoading(false)
        return
      }
      const response = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json()
      if (!response.ok) setError(result.error || 'Não foi possível carregar seus pedidos.')
      else setOrders(Array.isArray(result) ? result : [])
      setLoading(false)
    }
    void loadOrders()
  }, [])

  return <section className="account-box customer-orders"><h2>Meus pedidos</h2>{loading && <p>Carregando seus pedidos...</p>}{error && <p className="form-status">{error}</p>}{!loading && !error && orders.length === 0 && <p>Você ainda não possui pedidos.</p>}{orders.map((order) => <article className="customer-order" key={order.id}><div className="customer-order-header"><div><strong>Pedido #{order.id.slice(0, 8)}</strong><small>{new Date(order.created_at).toLocaleString('pt-BR')}</small></div><span className={`customer-order-status ${order.status}`}>{labels[order.status]}</span></div><p>{order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(' · ')}</p><div className="customer-order-footer"><strong>{money(order.total)}</strong>{order.status === 'shipped' && order.tracking_code && <span><b>Transportadora:</b> {getCarrierTrackingUrl(order.carrier, order.tracking_code) ? <a href={getCarrierTrackingUrl(order.carrier, order.tracking_code)!} target="_blank" rel="noreferrer">{order.carrier}</a> : (order.carrier || 'Não informada')} · <b>Rastreio:</b> {order.tracking_code}</span>}</div>{order.invoice_url && <a className="customer-order-invoice" href={order.invoice_url} target="_blank" rel="noreferrer">Baixar nota fiscal</a>}</article>)}</section>
}
