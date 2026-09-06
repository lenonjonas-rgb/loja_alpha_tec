import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { getCarrierTrackingUrl } from '../lib/carrier-tracking'
import { useCart } from './CartContext'
import type { Product } from '../lib/products'

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type OrderItem = { product_id: string; product_name: string; quantity: number; unit_price: number; total: number }
type Order = { id: string; created_at: string; delivered_at: string | null; status: OrderStatus; payment_status: string; shipping: number; total: number; tracking_code: string | null; carrier: string | null; invoice_url: string | null; order_items: OrderItem[]; product_reviews: { id: string } | { id: string }[] | null }
type PixPayment = { orderId: string; qrCode: string; qrCodeBase64: string; expiresAt: string | null }

const labels: Record<OrderStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`
const date = (value: string | null, fallback: string) => new Date(value || fallback).toLocaleDateString('pt-BR')
function hasReview(order: Order) { return Array.isArray(order.product_reviews) ? order.product_reviews.some((review) => Boolean(review?.id)) : Boolean(order.product_reviews?.id) }

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pointsBalance, setPointsBalance] = useState<{ points: number; discountValue: number } | null>(null)
  const [reviewOrderId, setReviewOrderId] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([])
  const [reviewMessage, setReviewMessage] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)
  const [buyAgainMessage, setBuyAgainMessage] = useState('')
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [viewingOrderId, setViewingOrderId] = useState('')
  const { addItem } = useCart()
  const router = useRouter()

  async function getToken() { if (!supabase) return ''; const { data } = await supabase.auth.getSession(); return data.session?.access_token || '' }

  useEffect(() => {
    async function loadOrders() {
      if (!supabase) { setError('Não foi possível carregar seus pedidos agora.'); setLoading(false); return }
      const token = await getToken()
      if (!token) { setLoading(false); return }
      const [ordersResponse, pointsResponse, productsResponse] = await Promise.all([fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }), fetch('/api/loyalty-points', { headers: { Authorization: `Bearer ${token}` } }), fetch('/api/products')])
      const result = await ordersResponse.json()
      if (!ordersResponse.ok) setError(result.error || 'Não foi possível carregar seus pedidos.')
      else setOrders(Array.isArray(result) ? result : [])
      if (pointsResponse.ok) setPointsBalance(await pointsResponse.json())
      if (productsResponse.ok) {
        const products = await productsResponse.json() as Product[]
        setProductImages(Object.fromEntries(products.map((product) => [product.id, product.image])))
      }
      setLoading(false)
    }
    void loadOrders()
  }, [])

  useEffect(() => {
    const itemNodes = Array.from(document.querySelectorAll<HTMLElement>('.customer-order-product'))
    const orderItems = orders.flatMap((order) => order.order_items)
    itemNodes.forEach((node, index) => {
      const image = productImages[orderItems[index]?.product_id]
      if (!image || node.querySelector('img')) return
      const imageElement = document.createElement('img')
      imageElement.src = image
      imageElement.alt = orderItems[index]?.product_name || 'Produto comprado'
      node.prepend(imageElement)
    })
  }, [orders, productImages])

  useEffect(() => {
    function viewOrder(event: Event) {
      const target = event.target as HTMLElement
      if (!target.closest('.order-view-button')) return
      const card = target.closest('.customer-order')
      const cards = Array.from(document.querySelectorAll('.customer-order'))
      const index = card ? cards.indexOf(card) : -1
      if (index >= 0) {
        const order = orders[index]
        setViewingOrderId((current) => current === order?.id ? '' : order?.id || '')
        const existingPanel = document.querySelector('.order-help-floating')
        existingPanel?.remove()
        if (order && !existingPanel) {
          const panel = document.createElement('div')
          panel.className = 'order-help-floating'
          panel.innerHTML = `<div class="order-help-summary"><h3>Detalhe da compra</h3><p>Pedido #${order.id.slice(0, 8)} · Compra em ${date(order.created_at, order.created_at)}</p><div><span>Produtos</span><strong>${money(order.order_items.reduce((total, item) => total + item.total, 0))}</strong></div><div><span>Frete</span><strong>${order.shipping > 0 ? money(order.shipping) : 'Grátis'}</strong></div><div class="order-help-total"><span>Total</span><strong>${money(order.total)}</strong></div></div><div class="order-help-section"><h3>Ajuda com a compra</h3></div><div class="order-help-section"><h3>Como enviar fotos de comprovação</h3><p>Fotografe o produto, a embalagem externa, a etiqueta de transporte e o problema encontrado. Envie imagens nítidas, sem cortar a etiqueta ou os detalhes do defeito.</p></div><div class="order-help-section"><h3>Cuidados para devolução</h3><p>Guarde o produto, acessórios e embalagem original. Não descarte a etiqueta e evite usar, desmontar ou alterar a peça antes da orientação da Alpha Tec.</p></div>`
          const helpSection = panel.querySelector('.order-help-section') as HTMLElement
          for (const topic of ['Recebi o produto com um problema', 'Recebi um pacote sem o produto', 'Preciso de ajuda com a NF-e', 'Não chegou o envio']) {
            const button = document.createElement('button')
            button.type = 'button'; button.textContent = topic; button.onclick = () => openWhatsApp(order, topic.toLowerCase()); helpSection.append(button)
          }
          card?.append(panel)
        }
      }
    }
    document.addEventListener('click', viewOrder)
    return () => document.removeEventListener('click', viewOrder)
  }, [orders])

  function addReviewPhoto(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return setReviewMessage('Selecione um arquivo de imagem válido.'); const reader = new FileReader(); reader.onload = () => setReviewPhotos((current) => [...current, String(reader.result)].slice(0, 5)); reader.readAsDataURL(file); event.target.value = '' }

  async function submitReview(orderId: string) {
    setSubmittingReview(true); setReviewMessage('')
    try {
      const token = await getToken(); if (!token) throw new Error('Sua sessão expirou. Entre novamente na conta.')
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, rating: reviewRating, comment: reviewComment, photos: reviewPhotos }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível registrar sua avaliação.')
      setOrders((items) => items.map((item) => item.id === orderId ? { ...item, product_reviews: { id: result.reviewId } } : item)); setReviewOrderId(''); setReviewComment(''); setReviewPhotos([]); setReviewMessage(`Avaliação enviada! Você ganhou ${result.pointsAwarded} pontos.`)
    } catch (caught) { setReviewMessage(caught instanceof Error ? caught.message : 'Não foi possível registrar sua avaliação.') } finally { setSubmittingReview(false) }
  }

  async function buyAgain(order: Order) {
    setBuyAgainMessage('Adicionando produtos ao carrinho...')
    try {
      const response = await fetch('/api/products'); const products = await response.json() as Product[]; const available = new Map(products.filter((product) => product.active !== false).map((product) => [product.id, product])); let added = 0
      for (const item of order.order_items) { const product = available.get(item.product_id); if (!product) continue; for (let quantity = 0; quantity < item.quantity; quantity += 1) addItem(product); added += item.quantity }
      if (added) await router.push('/cart')
      else setBuyAgainMessage('Os produtos deste pedido não estão mais disponíveis.')
    } catch { setBuyAgainMessage('Não foi possível adicionar os produtos ao carrinho.') }
  }

  async function continuePayment(orderId: string) { setPaymentMessage('Consultando pagamento...'); try { const token = await getToken(); const response = await fetch('/api/customer-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, action: 'continue' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível continuar o pagamento.'); if (result.confirmed) { setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: 'confirmed', payment_status: 'paid' } : item)); setPaymentMessage('Pagamento confirmado e pedido atualizado.') } else if (result.url) window.location.href = result.url; else if (result.pix) { setPixPayment({ orderId, ...result.pix }); setPaymentMessage('Pix recuperado. Conclua o pagamento pelo código abaixo.') } else setPaymentMessage('Pagamento ainda não foi aprovado. Tente novamente após concluir o pagamento.') } catch (caught) { setPaymentMessage(caught instanceof Error ? caught.message : 'Não foi possível continuar o pagamento.') } }
  async function cancelOrder(orderId: string) { if (!window.confirm('Cancelar este pedido pendente?')) return; try { const token = await getToken(); const response = await fetch('/api/customer-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, action: 'cancel' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível cancelar o pedido.'); setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: 'cancelled', payment_status: 'failed' } : item)); setPixPayment(null); setPaymentMessage('Pedido cancelado.') } catch (caught) { setPaymentMessage(caught instanceof Error ? caught.message : 'Não foi possível cancelar o pedido.') } }

  function openWhatsApp(order: Order, topic = 'dúvida sobre o pedido') {
    const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')
    const message = encodeURIComponent(`Olá, preciso de ajuda com o pedido #${order.id.slice(0, 8)}. Minha dúvida é: ${topic}.`)
    if (number) window.open(`https://wa.me/${number}?text=${message}`, '_blank', 'noopener,noreferrer')
    else setPaymentMessage('O WhatsApp da loja ainda não foi configurado.')
  }

  function renderOrderHelp(order: Order) {
    if (viewingOrderId !== order.id) return null
    return <div className="order-help-panel"><div className="order-help-summary"><h3>Detalhe da compra</h3><p>Pedido #{order.id.slice(0, 8)} · Compra em {date(order.created_at, order.created_at)}</p><div><span>Produtos</span><strong>{money(order.order_items.reduce((total, item) => total + item.total, 0))}</strong></div><div><span>Frete</span><strong>{order.shipping > 0 ? money(order.shipping) : 'Grátis'}</strong></div><div className="order-help-total"><span>Total</span><strong>{money(order.total)}</strong></div></div><div className="order-help-section"><h3>Ajuda com a compra</h3><button type="button" onClick={() => openWhatsApp(order, 'produto recebido com problema')}>Recebi o produto com um problema</button><button type="button" onClick={() => openWhatsApp(order, 'pacote recebido sem o produto')}>Recebi um pacote sem o produto</button><button type="button" onClick={() => openWhatsApp(order, 'dúvida sobre a nota fiscal')}>Preciso de ajuda com a NF-e</button><button type="button" onClick={() => openWhatsApp(order, 'não recebi o envio')}>Não chegou o envio</button></div><div className="order-help-section"><h3>Como enviar fotos de comprovação</h3><p>Fotografe o produto, a embalagem externa, a etiqueta de transporte e o problema encontrado. Envie imagens nítidas, sem cortar a etiqueta ou os detalhes do defeito.</p><button type="button" className="order-help-whatsapp" onClick={() => openWhatsApp(order, 'envio de fotos de comprovação')}>Enviar fotos pelo WhatsApp</button></div><div className="order-help-section"><h3>Cuidados para devolução</h3><p>Guarde o produto, acessórios e embalagem original. Não descarte a etiqueta e evite usar, desmontar ou alterar a peça antes da orientação da Alpha Tec.</p></div></div>
  }

  return <section id="orders" className="account-box customer-orders"><h2>Meus pedidos</h2><span id="reviews" className="account-anchor" aria-hidden="true" />{pointsBalance && <p className="loyalty-balance"><b>Seus pontos:</b> {pointsBalance.points} pts</p>}{paymentMessage && <p className="form-status">{paymentMessage}</p>}{buyAgainMessage && <p className="form-status success">{buyAgainMessage}</p>}{pixPayment && <div className="customer-pix-payment"><p>Copie o código Pix para concluir o pagamento:</p><input readOnly value={pixPayment.qrCode} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="outline-button" onClick={() => navigator.clipboard?.writeText(pixPayment.qrCode)}>Copiar código Pix</button></div>}{reviewMessage && !reviewOrderId && <p className="form-status success">{reviewMessage}</p>}{loading && <p>Carregando seus pedidos...</p>}{error && <p className="form-status">{error}</p>}{!loading && !error && orders.length === 0 && <p>Você ainda não possui pedidos.</p>}{orders.map((order) => <article className="customer-order" key={order.id}><div className="customer-order-date">{date(order.created_at, order.created_at)}</div><div className="customer-order-header"><div><strong>Pedido #{order.id.slice(0, 8)}</strong><small>Compra realizada em {date(order.created_at, order.created_at)}</small></div><span className={`customer-order-status ${order.status}`}>{labels[order.status]}</span></div><div className="customer-order-products">{order.order_items.map((item) => <div className="customer-order-product" key={`${order.id}-${item.product_id}`}><span>{item.product_name}</span><small>{item.quantity} un. · {money(item.unit_price)} cada</small></div>)}</div><p className="customer-order-arrival">{order.status === 'delivered' ? `Chegou em ${date(order.delivered_at, order.created_at)}` : `Status: ${labels[order.status]}`}</p><div className="customer-order-footer"><strong>Total {money(order.total)}</strong>{order.status === 'shipped' && order.tracking_code && <span><b>Transportadora:</b> {getCarrierTrackingUrl(order.carrier, order.tracking_code) ? <a href={getCarrierTrackingUrl(order.carrier, order.tracking_code)!} target="_blank" rel="noreferrer">{order.carrier}</a> : (order.carrier || 'Não informada')} · <b>Rastreio:</b> {order.tracking_code}</span>}</div><div className="customer-order-actions"><button type="button" className="order-view-button">Ver compra</button><button type="button" className="order-rebuy-button" onClick={() => void buyAgain(order)}>Comprar novamente</button></div>{order.status === 'pending' && order.payment_status !== 'paid' && <div className="pending-order-actions"><button type="button" className="primary-button" onClick={() => void continuePayment(order.id)}>Continuar pagamento</button><button type="button" className="outline-button" onClick={() => void cancelOrder(order.id)}>Cancelar pedido</button></div>}{order.invoice_url && <a className="customer-order-invoice" href={order.invoice_url} target="_blank" rel="noreferrer">Baixar nota fiscal</a>}{order.status === 'delivered' && !hasReview(order) && (reviewOrderId === order.id ? <div className="review-form"><p className="form-hint">Como foi receber seu pedido? Avalie e ganhe pontos.</p><div className="review-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= reviewRating ? 'active' : ''} onClick={() => setReviewRating(star)}>★</button>)}</div><textarea rows={3} placeholder="Conte como foi (opcional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /><label className="review-photo-input">Adicionar foto do produto recebido (opcional, até 5)<input type="file" accept="image/*" onChange={addReviewPhoto} /></label><div className="review-actions"><button type="button" className="primary-button" disabled={submittingReview} onClick={() => void submitReview(order.id)}>Enviar avaliação</button><button type="button" className="outline-button" onClick={() => setReviewOrderId('')}>Cancelar</button></div></div> : <button type="button" className="review-cta" onClick={() => setReviewOrderId(order.id)}>Avaliar pedido recebido e ganhar pontos</button>)}</article>)}</section>
}
