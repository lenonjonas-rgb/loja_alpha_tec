import Link from 'next/link'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useState } from 'react'
import { products } from '../../lib/products'
import { useCart } from '../../components/CartContext'
import { useCustomer } from '../../components/CustomerContext'
import { supabase } from '../../lib/supabase'

type ProductQuestion = { id: string; question: string; answer: string | null; answered_at: string | null; created_at: string }
type ProductReview = { id: string; rating: number; comment: string; photos: string[]; createdAt: string; customerName: string }
type ReviewSummary = { average: number; total: number; reviews: ProductReview[] }

const stars = (rating: number) => '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating))
const formatReviewDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const formatPrice = (price: any) => {
  const num = Number(price)
  return !isNaN(num) && num > 0 ? `R$ ${num.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
}

type DetailTab = 'description' | 'specifications' | 'compatibility'

export default function ProductPage() {
  const router = useRouter()
  const productId = router.query.id
  const { addItem } = useCart()
  const { customer } = useCustomer()
  const [added, setAdded] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('description')
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<any>(null)
  const [questions, setQuestions] = useState<ProductQuestion[]>([])
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({ average: 0, total: 0, reviews: [] })
  const [questionText, setQuestionText] = useState('')
  const [questionStatus, setQuestionStatus] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)

  useEffect(() => {
    if (!router.isReady || !productId) return
    fetch(`/api/questions?productId=${encodeURIComponent(String(productId))}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((list) => setQuestions(Array.isArray(list) ? list : []))
      .catch(() => setQuestions([]))
  }, [router.isReady, productId])

  useEffect(() => {
    if (!router.isReady || !productId) return
    fetch(`/api/reviews?productId=${encodeURIComponent(String(productId))}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => setReviewSummary(result && Array.isArray(result.reviews) ? result : { average: 0, total: 0, reviews: [] }))
      .catch(() => setReviewSummary({ average: 0, total: 0, reviews: [] }))
  }, [router.isReady, productId])

  async function submitQuestion(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return setQuestionStatus('Serviço indisponível no momento.')
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return setQuestionStatus('Entre na sua conta para enviar uma pergunta.')

    setSendingQuestion(true)
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, question: questionText }),
      })
      const result = await response.json()
      if (!response.ok) return setQuestionStatus(result.error || 'Não foi possível enviar a pergunta.')
      setQuestionText('')
      setQuestionStatus('Pergunta enviada! Você recebe a resposta em "Perguntas", no menu da sua conta.')
    } catch {
      setQuestionStatus('Não foi possível enviar a pergunta. Tente novamente.')
    } finally {
      setSendingQuestion(false)
    }
  }

  useEffect(() => {
    if (!router.isReady || !productId) return

    setLoading(true)
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : []))
      .then((databaseProducts) => {
        const dbItems = Array.isArray(databaseProducts) ? databaseProducts : []
        const fallbackItems = Array.isArray(products) ? products : []
        const foundDb = dbItems.find((item: any) => item && String(item.id) === String(productId))
        if (foundDb) {
          setProduct(foundDb)
        } else {
          const foundFallback = fallbackItems.find((item: any) => item && String(item.id) === String(productId))
          if (foundFallback) {
            setProduct(foundFallback)
          } else if (dbItems.length > 0) {
            setProduct(dbItems[0])
          }
        }
      })
      .catch(() => {
        const fallbackItems = Array.isArray(products) ? products : []
        const found = fallbackItems.find((item: any) => item && String(item.id) === String(productId))
        if (found) setProduct(found)
      })
      .finally(() => setLoading(false))
  }, [router.isReady, productId])

  if (loading && !product) {
    return (
      <section className="container product-detail">
        <Link href="/products" className="back-link">
          ← Voltar para produtos
        </Link>
        <div style={{ padding: '40px 0', color: '#686c70' }}>Carregando dados da peça...</div>
      </section>
    )
  }

  if (!product) {
    return (
      <section className="container product-detail">
        <Link href="/products" className="back-link">
          ← Voltar para produtos
        </Link>
        <h1>Produto não encontrado</h1>
      </section>
    )
  }

  const priceNum = Number(product.price || 0)
  const discountNum = Number(product.discountPercent || 0)
  const finalPrice = discountNum > 0 ? priceNum * (1 - discountNum / 100) : priceNum
  const stockNum = typeof product.stock === 'number' ? product.stock : 1
  const specificationLines = (product.specifications || '')
    .split(/\n|\r\n|\;\s*/)
    .map((line: string) => line.trim())
    .filter(Boolean)

  return (
    <section className="container product-detail">
      <Link href="/products" className="back-link">
        ← Voltar para produtos
      </Link>
      <div className="detail-layout">
        <div className="detail-image">
          <img src={product.image || '/logo-header-uniform.jpg'} alt={product.name || 'Produto'} />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">PEÇA ORIGINAL {product.brand || 'ALPHA TEC'}</p>
          <h1>{product.name}</h1>
          <p className="detail-code">Código do produto: AT-{productId || '001'}</p>

          <div className="detail-tabs" aria-label="Detalhes do produto">
            <button
              type="button"
              className={activeTab === 'description' ? 'active' : ''}
              onClick={() => setActiveTab('description')}
            >
              Descrição
            </button>
            <button
              type="button"
              className={activeTab === 'specifications' ? 'active' : ''}
              onClick={() => setActiveTab('specifications')}
            >
              Especificações
            </button>
            <button
              type="button"
              className={activeTab === 'compatibility' ? 'active' : ''}
              onClick={() => setActiveTab('compatibility')}
            >
              Compatibilidade
            </button>
          </div>

          <div className="detail-tab-panel">
            {activeTab === 'description' && (
              <p className="detail-description">{product.description || 'Descrição em breve.'}</p>
            )}
            {activeTab === 'specifications' && (
              <ul className="detail-spec-list">
                {specificationLines.length > 0 ? (
                  specificationLines.map((line: string) => <li key={line}>{line}</li>)
                ) : (
                  <li>As especificações do produto serão informadas em breve.</li>
                )}
              </ul>
            )}
            {activeTab === 'compatibility' && (
              <p className="detail-description">
                {product.compatibleEquipment || 'Consulte a compatibilidade com nossa equipe.'}
              </p>
            )}
          </div>

          {discountNum > 0 && (
            <del className="detail-old-price">{formatPrice(priceNum)}</del>
          )}
          <strong className="detail-price">{formatPrice(finalPrice)}</strong>
          <p className="stock-note">
            {stockNum === 0 ? 'Produto indisponível' : `${stockNum} unidades disponíveis`}
          </p>
          {priceNum > 0 && stockNum > 0 && (
            <>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  addItem({ ...product, price: finalPrice })
                  setAdded(true)
                }}
              >
                {added ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'} <span>+</span>
              </button>
              {added && (
                <Link href="/cart" className="cart-after-add">
                  Ir para o carrinho →
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <div className="product-reviews">
        <h2>Avaliações de quem comprou</h2>
        {reviewSummary.total > 0 ? (
          <>
            <div className="review-summary">
              <strong className="review-summary-score">{reviewSummary.average.toFixed(1).replace('.', ',')}</strong>
              <span className="review-stars">{stars(Math.round(reviewSummary.average))}</span>
              <span className="cart-muted">{reviewSummary.total} {reviewSummary.total === 1 ? 'avaliação' : 'avaliações'}</span>
            </div>
            <ul className="review-list">
              {reviewSummary.reviews.map((review) => (
                <li key={review.id}>
                  <div className="review-head">
                    <span className="review-stars">{stars(review.rating)}</span>
                    <strong>{review.customerName}</strong>
                    <small className="cart-muted">{formatReviewDate(review.createdAt)}</small>
                  </div>
                  {review.comment && <p className="review-comment">{review.comment}</p>}
                  {review.photos.length > 0 && (
                    <div className="review-photos">
                      {review.photos.map((photo) => (
                        <img key={photo} src={photo} alt={`Foto enviada por ${review.customerName}`} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="cart-muted">Este produto ainda não recebeu avaliações.</p>
        )}
      </div>

      <div className="product-questions">
        <h2>Perguntas sobre este produto</h2>
        {customer ? (
          <form className="product-question-form" onSubmit={submitQuestion}>
            <label>
              Sua pergunta
              <textarea
                required
                rows={3}
                maxLength={500}
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder="Ex.: esta peça é compatível com o modelo X?"
              />
            </label>
            <button className="primary-button" type="submit" disabled={sendingQuestion}>
              {sendingQuestion ? 'Enviando...' : 'Enviar pergunta'} <span>→</span>
            </button>
          </form>
        ) : (
          <p className="cart-muted">
            <Link href="/account">Entre na sua conta</Link> para perguntar sobre este produto.
          </p>
        )}
        {questionStatus && <p className="form-status">{questionStatus}</p>}

        {questions.length > 0 ? (
          <ul className="product-question-list">
            {questions.map((item) => (
              <li key={item.id}>
                <p className="product-question-text">{item.question}</p>
                <p className="product-question-answer">{item.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cart-muted">Ainda não há perguntas respondidas para este produto.</p>
        )}
      </div>
    </section>
  )
}
