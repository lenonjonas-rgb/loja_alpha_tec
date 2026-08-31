import { useEffect, useState } from 'react'

type Order = { id: string; created_at: string; status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; payment_status: 'pending' | 'paid' | 'failed' | 'refunded'; total: number; tracking_code: string | null; customers: { name: string; email: string; phone: string } | null; order_items: { product_name: string; quantity: number }[] }

type Props = { onMessage: (message: string) => void }
const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const
const orderLabel: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const paymentLabel: Record<string, string> = { pending: 'Pagamento pendente', paid: 'Pago', failed: 'Pagamento falhou', refunded: 'Estornado' }

export default function AdminOrders({ onMessage }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [dragOverColumn, setDragOverColumn] = useState<Order['status'] | null>(null)
  useEffect(() => { fetch('/api/orders').then((response) => response.ok ? response.json() : Promise.reject()).then(setOrders).catch(() => onMessage('Não foi possível carregar os pedidos.')) }, [onMessage])
  async function updateOrder(order: Order, status: Order['status'], paymentStatus = order.payment_status, trackingCode = order.tracking_code || '') { const response = await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, status, paymentStatus, trackingCode }) }); const result = await response.json(); if (!response.ok) return onMessage(result.error || 'Não foi possível atualizar o pedido.'); setOrders((items) => items.map((item) => item.id === result.id ? result : item)); onMessage('Pedido atualizado.') }
  function handleDrop(status: Order['status'], event: React.DragEvent) {
    event.preventDefault()
    setDragOverColumn(null)
    const orderId = event.dataTransfer.getData('text/plain')
    const order = orders.find((item) => item.id === orderId)
    if (order && order.status !== status) void updateOrder(order, status)
  }
  return <div className="orders-dashboard"><div className="lead-toolbar"><h2>Pedidos do site</h2><p className="form-hint">Arraste os cards entre as colunas para mudar o status do pedido.</p></div><div className="lead-board">{orderStatuses.map((status) => { const columnOrders = orders.filter((order) => order.status === status); return <div className={`lead-column ${dragOverColumn === status ? 'drag-over' : ''}`} key={status} onDragOver={(event) => { event.preventDefault(); setDragOverColumn(status) }} onDragLeave={() => setDragOverColumn((current) => (current === status ? null : current))} onDrop={(event) => handleDrop(status, event)}><div className={`lead-column-header ${status}`}><span>{orderLabel[status]}</span><strong>{columnOrders.length}</strong></div><div className="lead-column-body">{columnOrders.length === 0 && <p className="form-hint">Nenhum pedido nesta etapa.</p>}{columnOrders.map((order) => <article className="order-card" key={order.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', order.id)}><div className="lead-card-main"><div><h3>Pedido #{order.id.slice(0, 8)}</h3><p>{order.customers?.name || 'Cliente'} · {order.customers?.email || 'E-mail não informado'} · {new Date(order.created_at).toLocaleString('pt-BR')}</p><small>{order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(' · ')}</small></div><strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong></div><div className="lead-actions"><select value={order.payment_status} onChange={(event) => updateOrder(order, order.status, event.target.value as Order['payment_status'])}>{paymentStatuses.map((paymentStatus) => <option value={paymentStatus} key={paymentStatus}>{paymentLabel[paymentStatus]}</option>)}</select><input defaultValue={order.tracking_code || ''} placeholder="Código de rastreio" onBlur={(event) => updateOrder(order, order.status, order.payment_status, event.target.value)} /></div></article>)}</div></div> })}</div></div>
}
