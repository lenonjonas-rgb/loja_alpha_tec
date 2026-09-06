import Link from 'next/link'
import { ChangeEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'

type OrderItem = { product_id: string; product_name: string; quantity: number }
type Review = { id: string; rating: number; comment: string | null; photos: string[]; points_awarded: number; created_at: string }
type Order = { id: string; status: string; created_at: string; delivered_at: string | null; order_items: OrderItem[]; product_reviews: Review | Review[] | null }

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR')
const stars = (rating: number) => '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating))
function getReview(order: Order): Review | null {
  const review = Array.isArray(order.product_reviews) ? order.product_reviews[0] : order.product_reviews
  return review?.id ? review : null
}

export default function Opinioes() {
  const router = useRouter()
  const { customer } = useCustomer()
  const [orders, setOrders] = useState<Order[]>([])
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [openOrderId, setOpenOrderId] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=opinioes') }, [customer, router])

  useEffect(() => {
    async function load() {
      if (!supabase || !customer) return
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) return setLoading(false)
      try {
        const [ordersResponse, productsResponse] = await Promise.all([
          fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/products'),
        ])
        if (ordersResponse.ok) {
          const result = await ordersResponse.json()
          setOrders(Array.isArray(result) ? result : [])
        }
        if (productsResponse.ok) {
          const products = await productsResponse.json()
          setProductImages(Object.fromEntries((products || []).map((product: any) => [product.id, product.image])))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [customer])

  function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setMessage('Selecione um arquivo de imagem válido.')
    const reader = new FileReader()
    reader.onload = () => setPhotos((current) => [...current, String(reader.result)].slice(0, 5))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function startReview(orderId: string) {
    setOpenOrderId((current) => (current === orderId ? '' : orderId))
    setRating(5)
    setComment('')
    setPhotos([])
    setMessage('')
  }

  async function submitReview(orderId: string) {
    if (!supabase) return
    setSubmitting(true)
    setMessage('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente na conta.')
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, rating, comment, photos }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar sua opinião.')
      setOrders((items) => items.map((item) => item.id === orderId
        ? { ...item, product_reviews: { id: result.reviewId, rating, comment, photos, points_awarded: result.pointsAwarded, created_at: new Date().toISOString() } }
        : item))
      setOpenOrderId('')
      setMessage(`Opinião enviada! Você ganhou ${result.pointsAwarded} pontos.`)
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Não foi possível registrar sua opinião.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1></section>

  const delivered = orders.filter((order) => order.status === 'delivered')
  const pending = delivered.filter((order) => !getReview(order))
  const reviewed = delivered.filter((order) => getReview(order))

  const renderItems = (order: Order) => <div className="opinion-products">
    {order.order_items.map((item) => (
      <Link key={`${order.id}-${item.product_id}`} href={`/products/${item.product_id}`} className="opinion-product">
        {productImages[item.product_id] && <img src={productImages[item.product_id]} alt={item.product_name} />}
        <span>{item.product_name}{item.quantity > 1 ? ` (${item.quantity}x)` : ''}</span>
      </Link>
    ))}
  </div>

  return <section className="container checkout-page">
    <p className="eyebrow">MINHA CONTA</p>
    <h1>Opiniões</h1>
    <p className="cart-muted">Avalie os produtos que você já recebeu e ganhe pontos. Suas opiniões ajudam outros clientes a escolher.</p>
    {message && <p className="form-status">{message}</p>}

    {loading && <p className="cart-muted">Carregando suas compras...</p>}

    {!loading && <>
      <h2 className="opinion-heading">Aguardando sua opinião ({pending.length})</h2>
      {pending.length === 0
        ? <p className="cart-muted">Nenhuma compra pendente de avaliação.</p>
        : <ul className="opinion-list">
          {pending.map((order) => (
            <li key={order.id}>
              <small className="cart-muted">Pedido #{order.id.slice(0, 8)} · entregue em {formatDate(order.delivered_at || order.created_at)}</small>
              {renderItems(order)}
              {openOrderId === order.id ? (
                <div className="opinion-form">
                  <div className="opinion-rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" aria-label={`${value} estrelas`} className={value <= rating ? 'active' : ''} onClick={() => setRating(value)}>★</button>
                    ))}
                  </div>
                  <label>
                    Comentário
                    <textarea rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Conte como foi sua experiência com o produto." />
                  </label>
                  <label className="opinion-photo-input">
                    Fotos (opcional, até 5)
                    <input type="file" accept="image/*" onChange={addPhoto} />
                  </label>
                  {photos.length > 0 && <div className="review-photos">{photos.map((photo, index) => <img key={index} src={photo} alt={`Foto ${index + 1}`} />)}</div>}
                  <button className="primary-button" type="button" disabled={submitting} onClick={() => submitReview(order.id)}>
                    {submitting ? 'Enviando...' : 'Enviar opinião'} <span>→</span>
                  </button>{' '}
                  <button className="outline-button" type="button" onClick={() => setOpenOrderId('')}>Cancelar</button>
                </div>
              ) : (
                <button className="primary-button" type="button" onClick={() => startReview(order.id)}>Avaliar compra <span>→</span></button>
              )}
            </li>
          ))}
        </ul>}

      <h2 className="opinion-heading">Opiniões enviadas ({reviewed.length})</h2>
      {reviewed.length === 0
        ? <p className="cart-muted">Você ainda não enviou nenhuma opinião.</p>
        : <ul className="opinion-list">
          {reviewed.map((order) => {
            const review = getReview(order)!
            return <li key={order.id}>
              <small className="cart-muted">Pedido #{order.id.slice(0, 8)} · avaliado em {formatDate(review.created_at)}</small>
              {renderItems(order)}
              <span className="review-stars">{stars(review.rating)}</span>
              {review.comment && <p className="review-comment">{review.comment}</p>}
              {Array.isArray(review.photos) && review.photos.length > 0 && (
                <div className="review-photos">{review.photos.map((photo) => <img key={photo} src={photo} alt="Foto da avaliação" />)}</div>
              )}
              {review.points_awarded > 0 && <small className="cart-muted">+{review.points_awarded} pontos ganhos</small>}
            </li>
          })}
        </ul>}
    </>}
  </section>
}
