import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCarrierTrackingUrl } from '../lib/carrier-tracking'

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type Order = { id: string; created_at: string; status: OrderStatus; payment_status: string; shipping: number; total: number; tracking_code: string | null; carrier: string | null; invoice_url: string | null; order_items: { product_name: string; quantity: number; unit_price: number; total: number }[]; product_reviews: { id: string } | { id: string }[] | null }
type PixPayment = { orderId: string; qrCode: string; qrCodeBase64: string; expiresAt: string | null }

const labels: Record<OrderStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', processing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`

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

  async function getToken() {
    if (!supabase) return ''
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  useEffect(() => {
    async function loadOrders() {
      if (!supabase) {
        setError('Não foi possível carregar seus pedidos agora.')
        setLoading(false)
        return
      }
      const token = await getToken()
      if (!token) {
        setLoading(false)
        return
      }
      const [ordersResponse, pointsResponse] = await Promise.all([
        fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/loyalty-points', { headers: { Authorization: `Bearer ${token}` } })
      ])
      const result = await ordersResponse.json()
      if (!ordersResponse.ok) setError(result.error || 'Não foi possível carregar seus pedidos.')
      else setOrders(Array.isArray(result) ? result : [])
      if (pointsResponse.ok) setPointsBalance(await pointsResponse.json())
      setLoading(false)
    }
    void loadOrders()
  }, [])

  function addReviewPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setReviewMessage('Selecione um arquivo de imagem válido.')
    const reader = new FileReader()
    reader.onload = () => setReviewPhotos((current) => [...current, String(reader.result)].slice(0, 5))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  async function submitReview(orderId: string) {
    setSubmittingReview(true)
    setReviewMessage('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente na conta.')
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, rating: reviewRating, comment: reviewComment, photos: reviewPhotos })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar sua avaliação.')
      setOrders((items) => items.map((item) => item.id === orderId ? { ...item, product_reviews: { id: result.reviewId } } : item))
      setReviewOrderId('')
      setReviewComment('')
      setReviewPhotos([])
      setReviewMessage(`Avaliação enviada! Você ganhou ${result.pointsAwarded} pontos.`)
      const token2 = await getToken()
      if (token2) { const pointsResponse = await fetch('/api/loyalty-points', { headers: { Authorization: `Bearer ${token2}` } }); if (pointsResponse.ok) setPointsBalance(await pointsResponse.json()) }
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Não foi possível registrar sua avaliação.')
    } finally {
      setSubmittingReview(false)
    }
  }

  async function continuePayment(orderId: string) {
    setPaymentMessage('Consultando pagamento...')
    try {
      const token = await getToken()
      const response = await fetch('/api/customer-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, action: 'continue' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível continuar o pagamento.')
      if (result.confirmed) {
        setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: 'confirmed', payment_status: 'paid' } : item))
        setPaymentMessage('Pagamento confirmado e pedido atualizado.')
      } else if (result.url) {
        window.location.href = result.url
      } else if (result.pix) {
        setPixPayment({ orderId, ...result.pix })
        setPaymentMessage('Pix recuperado. Conclua o pagamento pelo código abaixo.')
      } else {
        setPaymentMessage('Pagamento ainda não foi aprovado. Tente novamente após concluir o pagamento.')
      }
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Não foi possível continuar o pagamento.')
    }
  }

  async function cancelOrder(orderId: string) {
    if (!window.confirm('Cancelar este pedido pendente?')) return
    try {
      const token = await getToken()
      const response = await fetch('/api/customer-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId, action: 'cancel' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível cancelar o pedido.')
      setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: 'cancelled', payment_status: 'failed' } : item))
      setPixPayment(null)
      setPaymentMessage('Pedido cancelado.')
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Não foi possível cancelar o pedido.')
    }
  }

  return <section className="account-box customer-orders"><h2>Meus pedidos</h2>{pointsBalance && <p className="loyalty-balance"><b>Seus pontos:</b> {pointsBalance.points} pts</p>}
{paymentMessage && <p className="form-status">{paymentMessage}</p>}{pixPayment && <div className="customer-pix-payment">{pixPayment.qrCodeBase64 && <img src={`data:image/png;base64,${pixPayment.qrCodeBase64}`} alt="QR Code Pix do pedido" />}<p>Copie o código Pix para concluir o pagamento:</p><input readOnly value={pixPayment.qrCode} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="outline-button" onClick={() => navigator.clipboard?.writeText(pixPayment.qrCode)}>Copiar código Pix</button></div>}
{reviewMessage && !reviewOrderId && <p className="form-status success">{reviewMessage}</p>}{loading && <p>Carregando seus pedidos...</p>}{error && <p className="form-status">{error}</p>}{!loading && !error && orders.length === 0 && <p>Você ainda não possui pedidos.</p>}{orders.map((order) => <article className="customer-order" key={order.id}><div className="customer-order-header"><div><strong>Pedido #{order.id.slice(0, 8)}</strong><small>{new Date(order.created_at).toLocaleString('pt-BR')}</small></div><span className={`customer-order-status ${order.status}`}>{labels[order.status]}</span></div><p>{order.order_items.map((item) => `${item.product_name} x${item.quantity}`).join(' · ')}</p><div className="customer-order-footer"><strong>{money(order.total)}</strong>{order.status === 'shipped' && order.tracking_code && <span><b>Transportadora:</b> {getCarrierTrackingUrl(order.carrier, order.tracking_code) ? <a href={getCarrierTrackingUrl(order.carrier, order.tracking_code)!} target="_blank" rel="noreferrer">{order.carrier}</a> : (order.carrier || 'Não informada')} · <b>Rastreio:</b> {order.tracking_code}</span>}</div>{order.status === 'pending' && order.payment_status !== 'paid' && <div className="pending-order-actions"><button type="button" className="primary-button" onClick={() => void continuePayment(order.id)}>Continuar pagamento</button><button type="button" className="outline-button" onClick={() => void cancelOrder(order.id)}>Cancelar pedido</button></div>}{order.invoice_url && <a className="customer-order-invoice" href={order.invoice_url} target="_blank" rel="noreferrer">Baixar nota fiscal</a>}{order.status === 'delivered' && (Array.isArray(order.product_reviews) ? order.product_reviews.length === 0 : !order.product_reviews) && (reviewOrderId === order.id ? <div className="review-form"><p className="form-hint">Como foi receber seu pedido? Avalie e ganhe pontos.</p><div className="review-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= reviewRating ? 'active' : ''} onClick={() => setReviewRating(star)}>★</button>)}</div><textarea rows={3} placeholder="Conte como foi (opcional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /><label className="review-photo-input">Adicionar foto do produto recebido (opcional, até 5)<input type="file" accept="image/*" onChange={addReviewPhoto} /></label>{reviewPhotos.length > 0 && <div className="review-photo-preview">{reviewPhotos.map((photo, index) => <img key={index} src={photo} alt={`Foto ${index + 1}`} />)}</div>}<div className="review-actions"><button type="button" className="primary-button" disabled={submittingReview} onClick={() => void submitReview(order.id)}>Enviar avaliação</button><button type="button" className="outline-button" onClick={() => { setReviewOrderId(''); setReviewComment(''); setReviewPhotos([]) }}>Cancelar</button></div></div> : <button type="button" className="review-cta" onClick={() => setReviewOrderId(order.id)}>Avaliar produto e ganhar pontos</button>)}</article>)}</section>
}
