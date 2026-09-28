import { ChangeEvent, useEffect, useState } from 'react'
import { getCarrierTrackingUrl } from '../lib/carrier-tracking'
import { generateShippingLabels, resolveLabelAddress, type LabelAddress, type LabelCustomer } from '../lib/shipping-label'

type Order = { id: string; created_at: string; status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; payment_status: 'pending' | 'paid' | 'failed' | 'refunded'; payment_method: string | null; total: number; tracking_code: string | null; carrier: string | null; invoice_url: string | null; shipping_address: LabelAddress | null; customer_address?: LabelAddress | null; customers: LabelCustomer | null; manual_customer_name?: string | null; manual_customer_phone?: string | null; manual_customer_email?: string | null; order_items: { product_name: string; internal_code: string | null; quantity: number }[] }
type CartOpportunity = { customer_id: string; updated_at: string; customer: { name: string | null; email: string | null; phone: string | null } | null; items: { product_name: string; internal_code: string | null; quantity: number; unit_price: number }[] }
type Product = { id: string; name: string; internalCode?: string; price: number; discountPercent?: number; active: boolean }
type ManualItem = { productId: string; quantity: number; unitPrice: number }
type Props = { products: Product[]; onMessage: (message: string) => void }

const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const
const orderLabel: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const paymentLabel: Record<string, string> = { pending: 'Pagamento pendente', paid: 'Pago', failed: 'Pagamento falhou', refunded: 'Estornado' }
const paymentMethodLabel: Record<string, string> = { pix: 'Pix (Mercado Pago)', card: 'Cartão (Mercado Pago)', boleto: 'Boleto (Mercado Pago)', manual: 'Venda fora do site', cash: 'Dinheiro', other: 'Outro' }
const blankManualItem = (): ManualItem => ({ productId: '', quantity: 1, unitPrice: 0 })

export default function AdminOrders({ products, onMessage }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [cartOpportunities, setCartOpportunities] = useState<CartOpportunity[]>([])
  const [activeStatus, setActiveStatus] = useState<Order['status']>('processing')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', shipping: '0', paymentMethod: 'manual', status: 'confirmed' as Order['status'], paymentStatus: 'paid' as Order['payment_status'], carrier: '', trackingCode: '' })
  const [manualItems, setManualItems] = useState<ManualItem[]>([blankManualItem()])
  const activeProducts = products.filter((product) => product.active !== false)

  useEffect(() => {
    fetch('/api/orders').then((response) => response.ok ? response.json() : Promise.reject()).then(setOrders).catch(() => onMessage('Não foi possível carregar os pedidos.'))
    fetch('/api/abandoned-carts').then((response) => response.ok ? response.json() : Promise.reject()).then(setCartOpportunities).catch(() => onMessage('Não foi possível carregar os carrinhos para recuperação.'))
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

  async function deleteSelectedCancelled() {
    const targets = orders.filter((order) => selectedIds.includes(order.id) && order.status === 'cancelled')
    if (!targets.length) return onMessage('Selecione pedidos na aba Cancelado para excluir.')
    if (!window.confirm(`Excluir permanentemente ${targets.length} pedido(s) cancelado(s)? Essa ação não pode ser desfeita.`)) return

    const results = await Promise.all(targets.map((order) => fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id }),
    }).then(async (response) => ({ response, result: await response.json() }))))
    const failed = results.filter(({ response }) => !response.ok)
    const deletedIds = new Set(results.filter(({ response }) => response.ok).map(({ result }) => result.id))
    setOrders((items) => items.filter((item) => !deletedIds.has(item.id)))
    setSelectedIds([])
    onMessage(failed.length ? `${targets.length - failed.length} pedido(s) excluído(s); ${failed.length} falhou(ram).` : `${targets.length} pedido(s) excluído(s).`)
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

  function updateManualItem(index: number, patch: Partial<ManualItem>) {
    setManualItems((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function selectManualProduct(index: number, productId: string) {
    const product = activeProducts.find((item) => item.id === productId)
    const basePrice = Number(product?.price || 0)
    const discount = Number(product?.discountPercent || 0)
    const finalPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice
    updateManualItem(index, { productId, unitPrice: Number(finalPrice.toFixed(2)) })
  }

  function addManualItem() {
    setManualItems((items) => [...items, blankManualItem()])
  }

  function removeManualItem(index: number) {
    setManualItems((items) => (items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items))
  }

  async function createManualOrder() {
    const validItems = manualItems.filter((item) => item.productId && item.quantity > 0)
    if (!manualForm.customerName.trim()) return onMessage('Informe o nome do cliente para o pedido manual.')
    if (!validItems.length) return onMessage('Adicione pelo menos um item ao pedido.')
    const payload = {
      customerName: manualForm.customerName.trim(),
      customerPhone: manualForm.customerPhone.trim(),
      customerEmail: manualForm.customerEmail.trim(),
      shipping: Number(manualForm.shipping.replace(',', '.')) || 0,
      paymentMethod: manualForm.paymentMethod,
      status: manualForm.status,
      paymentStatus: manualForm.paymentStatus,
      carrier: manualForm.carrier.trim(),
      trackingCode: manualForm.trackingCode.trim(),
      items: validItems.map((item) => {
        const product = activeProducts.find((productItem) => productItem.id === item.productId)
        return { productId: item.productId, name: product?.name || 'Item', internalCode: product?.internalCode || '', quantity: item.quantity, unitPrice: item.unitPrice }
      }),
    }
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível registrar o pedido manual.')
    setOrders((items) => [result, ...items])
    setManualForm({ customerName: '', customerPhone: '', customerEmail: '', shipping: '0', paymentMethod: 'manual', status: 'confirmed', paymentStatus: 'paid', carrier: '', trackingCode: '' })
    setManualItems([blankManualItem()])
    setShowManualForm(false)
    setActiveStatus(result.status)
    onMessage('Pedido manual registrado com sucesso.')
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
  const visibleCarts = activeStatus === 'pending' ? cartOpportunities : []
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id))

  return <div className="orders-dashboard">
    <div className="lead-toolbar">
      <div><h2>Pedidos do site</h2><p className="form-hint">Selecione um status para ver seus pedidos.</p></div>
      <div className="bulk-order-actions"><button className="outline-button" type="button" onClick={() => setShowManualForm((current) => !current)}>{showManualForm ? 'Cancelar' : 'Novo pedido manual'}</button><button className="label-button bulk-label-button" type="button" disabled={!selectedIds.length} onClick={() => void printLabels(orders.filter((order) => selectedIds.includes(order.id)))}>Imprimir etiquetas ({selectedIds.length})</button>{activeStatus === 'cancelled' ? <button className="bulk-cancel-button" type="button" disabled={!selectedIds.length} onClick={() => void deleteSelectedCancelled()}>Excluir selecionados</button> : <button className="bulk-cancel-button" type="button" disabled={!selectedIds.length} onClick={() => void cancelSelected()}>Cancelar selecionados</button>}</div>
    </div>
    {showManualForm && <div className="manual-order-form">
      <h3>Pedido feito fora do site</h3>
      <p className="form-hint">Registre vendas por telefone, WhatsApp ou presenciais. O cliente não precisa ter cadastro no site.</p>
      <div className="form-grid">
        <label>Nome do cliente<input required value={manualForm.customerName} onChange={(event) => setManualForm({ ...manualForm, customerName: event.target.value })} placeholder="Ex.: João da Silva" /></label>
        <label>Telefone<input value={manualForm.customerPhone} onChange={(event) => setManualForm({ ...manualForm, customerPhone: event.target.value })} placeholder="(11) 99999-9999" /></label>
        <label>E-mail<input type="email" value={manualForm.customerEmail} onChange={(event) => setManualForm({ ...manualForm, customerEmail: event.target.value })} placeholder="opcional" /></label>
      </div>
      <div className="manual-order-items">
        {manualItems.map((item, index) => <div className="manual-order-item-row" key={index}>
          <select value={item.productId} onChange={(event) => selectManualProduct(index, event.target.value)}>
            <option value="">Selecione um produto</option>
            {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <input type="number" min="1" value={item.quantity} onChange={(event) => updateManualItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} />
          <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateManualItem(index, { unitPrice: Number(event.target.value) || 0 })} />
          <button type="button" className="bulk-remove-button" onClick={() => removeManualItem(index)} aria-label="Remover item">×</button>
        </div>)}
        <button className="outline-button" type="button" onClick={addManualItem}>Adicionar item</button>
      </div>
      <div className="form-grid">
        <label>Frete (R$)<input type="number" min="0" step="0.01" value={manualForm.shipping} onChange={(event) => setManualForm({ ...manualForm, shipping: event.target.value })} /></label>
        <label>Forma de pagamento<select value={manualForm.paymentMethod} onChange={(event) => setManualForm({ ...manualForm, paymentMethod: event.target.value })}>{Object.entries(paymentMethodLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Status do pedido<select value={manualForm.status} onChange={(event) => setManualForm({ ...manualForm, status: event.target.value as Order['status'] })}>{orderStatuses.map((status) => <option key={status} value={status}>{orderLabel[status]}</option>)}</select></label>
        <label>Status do pagamento<select value={manualForm.paymentStatus} onChange={(event) => setManualForm({ ...manualForm, paymentStatus: event.target.value as Order['payment_status'] })}>{paymentStatuses.map((paymentStatus) => <option key={paymentStatus} value={paymentStatus}>{paymentLabel[paymentStatus]}</option>)}</select></label>
        <label>Transportadora<input value={manualForm.carrier} onChange={(event) => setManualForm({ ...manualForm, carrier: event.target.value })} placeholder="opcional" /></label>
        <label>Código de rastreio<input value={manualForm.trackingCode} onChange={(event) => setManualForm({ ...manualForm, trackingCode: event.target.value })} placeholder="opcional" /></label>
      </div>
      <button className="primary-button" type="button" onClick={() => void createManualOrder()}>Registrar pedido <span>→</span></button>
    </div>}
    <nav className="order-status-tabs" aria-label="Status dos pedidos">
      {orderStatuses.map((status) => <button key={status} type="button" className={activeStatus === status ? `active ${status}` : ''} onClick={() => { setActiveStatus(status); setSelectedIds([]) }}><span>{orderLabel[status]}</span><strong>{orders.filter((order) => order.status === status).length}</strong></button>)}
    </nav>
    <section className="order-status-panel">
      <div className="order-list-toolbar">
        <label><input type="checkbox" checked={allSelected} onChange={() => toggleAll(visibleOrders)} /> Selecionar todos</label>
        <span>{visibleOrders.length} pedido(s) em {orderLabel[activeStatus].toLowerCase()}</span>
      </div>
      {visibleCarts.length > 0 && <div className="cart-recovery-list">
        <div className="cart-recovery-heading"><h3>Carrinhos para recuperar</h3><span>{visibleCarts.length} cliente(s)</span></div>
        {visibleCarts.map((cart) => {
          const customer = cart.customer
          const phone = String(customer?.phone || '').replace(/\D/g, '')
          const message = `Olá${customer?.name ? `, ${customer.name}` : ''}! Vi que você deixou alguns itens no carrinho da Alpha Tec. Posso ajudar com alguma dúvida?`
          const total = cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
          return <article className="cart-recovery-card" key={cart.customer_id}>
            <div className="cart-recovery-main">
              <strong>{customer?.name || 'Cliente'}</strong>
              <p>{customer?.email || 'E-mail não informado'}{customer?.phone ? ` · ${customer.phone}` : ''} · Atualizado em {new Date(cart.updated_at).toLocaleString('pt-BR')}</p>
              <small>{cart.items.map((item) => `${item.internal_code ? `[${item.internal_code}] ` : ''}${item.product_name} x${item.quantity}`).join(' · ')}</small>
            </div>
            <strong className="cart-recovery-total">R$ {total.toFixed(2).replace('.', ',')}</strong>
            <div className="cart-recovery-actions">
              {phone && <a className="cart-contact-whatsapp" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
              {customer?.email && <a className="cart-contact-email" href={`mailto:${customer.email}?subject=${encodeURIComponent('Podemos ajudar com seu carrinho?')}`}>E-mail</a>}
            </div>
          </article>
        })}
      </div>}
      {!visibleOrders.length && !visibleCarts.length && <p className="form-hint">Nenhum pedido nesta etapa.</p>}
      {visibleOrders.map((order) => {
        const expanded = expandedIds.includes(order.id)
        return <article className={`order-card ${expanded ? 'expanded' : ''}`} key={order.id} onClick={() => toggleExpanded(order.id)}>
          <div className="order-summary">
            <div className="order-select" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelection(order.id)} aria-label={`Selecionar pedido ${order.id.slice(0, 8)}`} /></div>
            <div className="order-summary-main"><h3>Pedido #{order.id.slice(0, 8)}</h3><p>{order.customers?.name || order.manual_customer_name || 'Cliente'} · {order.customers?.email || order.manual_customer_email || 'E-mail não informado'} · {new Date(order.created_at).toLocaleString('pt-BR')}</p><small>{order.order_items.map((item) => `${item.internal_code ? `[${item.internal_code}] ` : ''}${item.product_name} x${item.quantity}`).join(' · ')}</small></div>
            <strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong>
            <span className="order-expand-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
          </div>
          {expanded && <div className="order-details" onClick={(event) => event.stopPropagation()}>
            <p className="order-payment-method">Pagamento: <strong>{order.payment_method ? (paymentMethodLabel[order.payment_method] || order.payment_method) : 'Não informado'}</strong></p>
            {!order.customers && (order.manual_customer_phone || order.manual_customer_email) && <p className="form-hint">Pedido manual · {order.manual_customer_phone || 'sem telefone'}{order.manual_customer_email ? ` · ${order.manual_customer_email}` : ''}</p>}
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
