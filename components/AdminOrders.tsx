import { useEffect, useState } from 'react'

type Order = { id: string; created_at: string; status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; payment_status: 'pending' | 'paid' | 'failed' | 'refunded'; total: number; customers: { name: string; email: string; phone: string } | null; order_items: { product_name: string; quantity: number }[] }

type Props = { onMessage: (message: string) => void }
const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const
const orderLabel: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const paymentLabel: Record<string, string> = { pending: 'Pagamento pendente', paid: 'Pago', failed: 'Pagamento falhou', refunded: 'Estornado' }

export default function AdminOrders({ onMessage }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('all')
  useEffect(() => { fetch('/api/orders').then((response) => response.ok ? response.json() : Promise.reject()).then(setOrders).catch(() => onMessage('Não foi possível carregar os pedidos.')) }, [onMessage])
  async function updateOrder(order: Order, status: Order['status'], paymentStatus = order.payment_status) { const response = await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, status, paymentStatus }) }); if (!response.ok) return onMessage('Não foi possível atualizar o pedido.'); const updated = await response.json(); setOrders((items) => items.map((item) => item.id === updated.id ? updated : item)); onMessage('Pedido atualizado.') }
  const visibleOrders = filter === 'all' ? orders : orders.filter((order) => order.status === filter)
  return <div className="orders-dashboard"><div className="lead-toolbar"><h2>Pedidos do site</h2><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos os pedidos</option>{orderStatuses.map((status) => <option value={status} key={status}>{orderLabel[status]}</option>)}</select></div>{visibleOrders.length === 0 && <p className="form-hint">Nenhum pedido nesta etapa.</p>}{visibleOrders.map((order) => <article className="order-card" key={order.id}><div className="lead-card-main"><div><h3>Pedido #{order.id.slice(0, 8)}</h3><p>{order.customers?.name || 'Cliente'} · {order.customers?.email || 'E-mail não informado'} · {new Date(order.created_at).toLocaleString('pt-BR')}</p><small>{order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(' · ')}</small></div><strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong></div><div className="lead-actions"><select value={order.status} onChange={(event) => updateOrder(order, event.target.value as Order['status'])}>{orderStatuses.map((status) => <option value={status} key={status}>{orderLabel[status]}</option>)}</select><select value={order.payment_status} onChange={(event) => updateOrder(order, order.status, event.target.value as Order['payment_status'])}>{paymentStatuses.map((status) => <option value={status} key={status}>{paymentLabel[status]}</option>)}</select></div></article>)}</div>
}
