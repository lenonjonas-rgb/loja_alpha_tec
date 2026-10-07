import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { StoreReviewsResponse } from '../lib/store-reviews'

export default function StoreReviews() {
  const [summary, setSummary] = useState<StoreReviewsResponse | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadReviews() {
      setError('')
      setSummary(null)
      try {
        const response = await fetch('/api/reviews?scope=store', { signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível carregar as avaliações. Tente novamente.')
        const result: StoreReviewsResponse = await response.json()
        if (!Array.isArray(result.reviews) || !Number.isInteger(result.total) || result.total < 0) {
          throw new Error('Não foi possível carregar as avaliações. Tente novamente.')
        }
        setSummary(result)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as avaliações.')
      }
    }
    void loadReviews()
    return () => controller.abort()
  }, [attempt])

  return (
    <section className="container store-reviews-section" aria-labelledby="store-reviews-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EXPERIÊNCIAS REAIS</p>
          <h2 id="store-reviews-title">Avaliações de quem recebeu</h2>
        </div>
        <Link href="/opinioes">Avaliar minha compra <span>→</span></Link>
      </div>
      <p className="store-reviews-intro">Opiniões sobre pedidos entregues, enviadas pelos próprios compradores. Veja as avaliações mais recentes, com fotos quando compartilhadas pelos clientes.</p>
      {!summary && !error && <p role="status" className="cart-muted">Carregando avaliações de compradores...</p>}
      {error && (
        <div className="store-reviews-notice" role="alert">
          <p>{error}</p>
          <button type="button" className="outline-button" onClick={() => setAttempt((current) => current + 1)}>Tentar novamente</button>
        </div>
      )}
      {summary && summary.total === 0 && (
        <div className="store-reviews-notice">
          <strong>As próximas experiências podem ajudar outros compradores.</strong>
          <p>A loja ainda não tem avaliações de pedidos entregues. Já recebeu sua compra? Acesse sua conta e compartilhe sua experiência.</p>
          <Link href="/opinioes" className="outline-button">Compartilhar minha experiência</Link>
        </div>
      )}
      {summary && summary.total > 0 && (
        <>
          <p className="store-reviews-count">{summary.total} {summary.total === 1 ? 'avaliação de pedido entregue' : 'avaliações de pedidos entregues'}</p>
          <ul className="store-reviews-grid">
            {summary.reviews.map((review) => (
              <li key={review.id} className="store-review-card">
                <div className="store-review-heading">
                  <span className="review-stars" aria-label={`Nota ${review.rating} de 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  <span className="store-review-verified">Pedido entregue</span>
                </div>
                {review.comment && <blockquote>{review.comment}</blockquote>}
                {review.photos.length > 0 && (
                  <div className="store-review-photos">
                    {review.photos.slice(0, 2).map((photo, index) => (
                      <a key={photo} href={photo} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${index + 1} enviada por ${review.customerName}`}>
                        <img src={photo} alt={`Foto da compra enviada por ${review.customerName}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="store-review-author">
                  <strong>{review.customerName}</strong>
                  <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
