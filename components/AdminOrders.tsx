import { ChangeEvent, useEffect, useState } from 'react'
import { getCarrierTrackingUrl } from '../lib/carrier-tracking'
import { generateShippingLabels, resolveLabelAddress, type LabelAddress, type LabelCustomer } from '../lib/shipping-label'

type Order = { id: string; created_at: string; status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; payment_status: 'pending' | 'paid' | 'failed' | 'refunded'; payment_method: 'pix' | 'card' | 'boleto' | null; total: number; tracking_code: string | null; carrier: string | null; invoice_url: string | null; shipping_address: LabelAddress | null; customer_address?: LabelAddress | null; customers: LabelCustomer | null; order_items: { product_name: string; quantity: number }[] }
type Props = { onMessage: (message: string) => void }

const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const
const orderLabel: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const paymentLabel: Record<string, string> = { pending: 'Pagamento pendente', paid: 'Pago', failed: 'Pagamento falhou', refunded: 'Estornado' }
const paymentMethodLabel: Record<string, string> = { pix: 'Pix (Mercado Pago)', card: 'Cartão (Mercado Pago)', boleto: 'Boleto (Mercado Pago)' }

export default function AdminOrders({ onMessage }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [activeStatus, setActiveStatus] = useState<Order['status']>('processing')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/orders').then((response) => response.ok ? response.json() : Promise.reject()).then(setOrders).catch(() => onMessage('Não foi possível carregar os pedidos.'))
  }, [onMessage])

  async function updateOrder(order: Order, status: Order['status'], paymentStatus = order.payment_status, trackingCode = order.tracking_code || '', invoiceBase64?: string) {
    const response = await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, status, paymentStatus, trackingCode, invoiceBase64 }) })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível atualizar o pedido.')
    setOrders((items) => items.map((item) => item.id === result.id ? result : item))
    onMessage('Pedido atualizado.')
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm(`Excluir o pedido #${order.id.slice(0, 8)}? Essa ação não pode ser desfeita.`)) return
    const response = await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id }) })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível excluir o pedido.')
    setOrders((items) => items.filter((item) => item.id !== order.id))
    setSelectedIds((items) => items.filter((id) => id !== order.id))
    onMessage('Pedido cancelado excluído.')
  }

  async function cancelSelected() {
    const targets = orders.filter((order) => selectedIds.includes(order.id) && order.status !== 'cancelled')
    if (!targets.length) return onMessage('Selecione pelo menos um pedido que ainda não esteja cancelado.')
    if (!window.confirm(`Cancelar ${targets.length} pedido(s) selecionado(s)?`)) return

    const results = await Promise.all(targets.map((order) => fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status: 'cancelled', paymentStatus: order.payment_status, trackingCode: order.tracking_code || '' }),
    }).then(async (response) => ({ response, result: await response.json() }))))
    const failed = results.filter(({ response }) => !response.ok)
    const updatedById = new Map(results.filter(({ response }) => response.ok).map(({ result }) => [result.id, result as Order]))
    setOrders((items) => items.map((item) => updatedById.get(item.id) || item))
    setSelectedIds([])
    onMessage(failed.length ? `${targets.length - failed.length} pedido(s) cancelado(s); ${failed.length} falhou(ram).` : `${targets.length} pedido(s) cancelado(s).`)
  }

  function uploadInvoice(order: Order, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') return onMessage('Selecione um arquivo PDF para a nota fiscal.')
    const reader = new FileReader()
    reader.onload = () => void updateOrder(order, order.status, order.payment_status, order.tracking_code || '', String(reader.result))
    reader.onerror = () => onMessage('Não foi possível ler o arquivo da nota fiscal.')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleAll(visible: Order[]) {
    const visibleIds = visible.map((order) => order.id)
    setSelectedIds((current) => visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])))
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function printLabels(targetOrders: Order[]) {
    const prepared: Order[] = []
    for (const order of targetOrders) {
      let current = order
      if (/correios/i.test(order.carrier || '') && !order.tracking_code) {
        try {
          const response = await fetch('/api/correios-label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) })
          const result = await response.json()
          if (response.ok && result.trackingCode) {
            current = { ...order, tracking_code: result.trackingCode }
            setOrders((items) => items.map((item) => item.id === order.id ? current : item))
          }
        } catch { /* usa a referência interna quando a API oficial falhar */ }
      }
      if (!resolveLabelAddress(current).cep) return onMessage(`O pedido #${order.id.slice(0, 8)} não tem CEP no pedido nem no cadastro do cliente.`)
      prepared.push(current)
    }
    if (!prepared.length) return onMessage('Selecione pelo menos um pedido.')
    try {
      await generateShippingLabels(prepared)
      setSelectedIds([])
      onMessage(`${prepared.length} etiqueta(s) gerada(s) em A4 paisagem.`)
    } catch {
      onMessage('Não foi possível gerar as etiquetas.')
    }
  }

  const visibleOrders = orders.filter((order) => order.status === activeStatus)
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id))

  return <div className="orders-dashboard">
    <div className="lead-toolbar">
      <div><h2>Pedidos do site</h2><p className="form-hint">Selecione um status para ver seus pedidos.</p></div>
      <div className="bulk-order-actions"><button className="label-button bulk-label-button" type="button" disabled={!selectedIds.length} onClick={() => void printLabels(orders.filter((order) => selectedIds.includes(order.id)))}>Imprimir etiquetas ({selectedIds.length})</button><button className="bulk-cancel-button" type="button" disabled={!selectedIds.length} onClick={() => void cancelSelected()}>Cancelar selecionados</button></div>
    </div>
    <nav className="order-status-tabs" aria-label="Status dos pedidos">
      {orderStatuses.map((status) => <button key={status} type="button" className={activeStatus === status ? `active ${status}` : ''} onClick={() => { setActiveStatus(status); setSelectedIds([]) }}><span>{orderLabel[status]}</span><strong>{orders.filter((order) => order.status === status).length}</strong></button>)}
    </nav>
    <section className="order-status-panel">
      <div className="order-list-toolbar">
        <label><input type="checkbox" checked={allSelected} onChange={() => toggleAll(visibleOrders)} /> Selecionar todos</label>
        <span>{visibleOrders.length} pedido(s) em {orderLabel[activeStatus].toLowerCase()}</span>
      </div>
      {!visibleOrders.length && <p className="form-hint">Nenhum pedido nesta etapa.</p>}
      {visibleOrders.map((order) => {
        const expanded = expandedIds.includes(order.id)
        return <article className={`order-card ${expanded ? 'expanded' : ''}`} key={order.id} onClick={() => toggleExpanded(order.id)}>
          <div className="order-summary">
            <div className="order-select" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelection(order.id)} aria-label={`Selecionar pedido ${order.id.slice(0, 8)}`} /></div>
            <div className="order-summary-main"><h3>Pedido #{order.id.slice(0, 8)}</h3><p>{order.customers?.name || 'Cliente'} · {order.customers?.email || 'E-mail não informado'} · {new Date(order.created_at).toLocaleString('pt-BR')}</p><small>{order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(' · ')}</small></div>
            <strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong>
            <span className="order-expand-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
          </div>
          {expanded && <div className="order-details" onClick={(event) => event.stopPropagation()}>
            <p className="order-payment-method">Pagamento: <strong>{order.payment_method ? paymentMethodLabel[order.payment_method] : 'Não informado'}</strong></p>
            <p className="order-invoice-status">{order.invoice_url ? <a href={order.invoice_url} target="_blank" rel="noreferrer">Ver nota fiscal anexada</a> : 'Sem nota fiscal anexada'}</p>
            <div className="lead-actions"><select value={order.payment_status} onChange={(event) => void updateOrder(order, order.status, event.target.value as Order['payment_status'])}>{paymentStatuses.map((paymentStatus) => <option key={paymentStatus} value={paymentStatus}>{paymentLabel[paymentStatus]}</option>)}</select><select value={order.status} onChange={(event) => void updateOrder(order, event.target.value as Order['status'])}>{orderStatuses.map((status) => <option key={status} value={status}>{orderLabel[status]}</option>)}</select></div>
            <p className="order-carrier">{order.carrier ? <>{order.carrier} {order.tracking_code && <a href={getCarrierTrackingUrl(order.carrier, order.tracking_code) || '#'} target="_blank" rel="noreferrer">{order.tracking_code}</a>}</> : 'Transportadora não definida'}</p>
            <input className="tracking-code-input" defaultValue={order.tracking_code || ''} placeholder="Código de rastreio" onBlur={(event) => { const value = event.target.value.trim(); if (value !== (order.tracking_code || '')) void updateOrder(order, order.status, order.payment_status, value) }} />
            {activeStatus === 'processing' && <button type="button" className="label-button" onClick={() => void printLabels([order])}>Gerar etiqueta Alpha Tec</button>}
            {activeStatus === 'processing' && <label className="invoice-upload">{order.invoice_url ? 'Substituir nota fiscal' : 'Anexar nota fiscal (PDF)'}<input type="file" accept="application/pdf" onChange={(event) => uploadInvoice(order, event)} /></label>}
            {activeStatus === 'cancelled' && <button type="button" className="lead-delete-button order-delete-button" onClick={() => void deleteOrder(order)}>Excluir pedido</button>}
          </div>}
        </article>
      })}
    </section>
  </div>
}
