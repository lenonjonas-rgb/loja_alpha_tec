import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Product } from '../lib/products'

const categories = [
  { title: 'Esteiras', detail: 'Correias, roletes e placas', image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=800&q=80' },
  { title: 'Musculação', detail: 'Cabos, polias e estruturas', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80' },
  { title: 'Bicicletas', detail: 'Pedais, correias e sensores', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80' },
  { title: 'Acessórios', detail: 'Manoplas, parafusos e mais', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80' },
]
const formatPrice = (price: number) => price ? `R$ ${price.toFixed(2).replace('.', ',')}` : 'Consulte o preço'

function HeroBanner({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imgError, setImgError] = useState<Record<string, boolean>>({})

  const offerProducts = products.filter(
    (item) => item.active !== false && (item.flashSale || (item.discountPercent && item.discountPercent > 0) || item.showInBanner)
  )

  if (offerProducts.length === 0) {
    return (
      <div className="hero-banner-single">
        <span className="hero-label">
          PERFORMANCE<br /><b>EM CADA DETALHE</b>
        </span>
      </div>
    )
  }

  const slides = [
    { type: 'default' as const },
    ...offerProducts.map((p) => ({ type: 'product' as const, product: p })),
  ]

  const totalSlides = slides.length

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % totalSlides)
    }, 4000)
    return () => clearInterval(timer)
  }, [totalSlides, paused])

  const currentSlide = slides[index % totalSlides]

  return (
    <div
      className="hero-banner-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {currentSlide.type === 'default' ? (
        <div className="hero-slide hero-slide-default">
          <span className="hero-label">
            PERFORMANCE<br /><b>EM CADA DETALHE</b>
          </span>
        </div>
      ) : (
        <div className="hero-slide hero-slide-product">
          <div className="hero-product-content">
            <span className="hero-product-badge">
              {currentSlide.product.flashSale
                ? 'OFERTA RELÂMPAGO'
                : currentSlide.product.discountPercent
                ? `OFERTA -${currentSlide.product.discountPercent}%`
                : 'DESTAQUE DA SEMANA'}
            </span>
            <h2 className="hero-product-title">{currentSlide.product.name}</h2>
            <div className="hero-product-prices">
              {Boolean(currentSlide.product.discountPercent) && (
                <del>{formatPrice(currentSlide.product.price)}</del>
              )}
              <strong>
                {formatPrice(
                  currentSlide.product.discountPercent
                    ? currentSlide.product.price * (1 - currentSlide.product.discountPercent / 100)
                    : currentSlide.product.price
                )}
              </strong>
            </div>
            <Link href={`/products/${currentSlide.product.id}`} className="primary-button hero-product-btn">
              Ver oferta <span>→</span>
            </Link>
          </div>
          <div className="hero-product-image-wrap">
            <img
              src={
                imgError[currentSlide.product.id] || !currentSlide.product.image
                  ? '/logo-header-uniform.jpg'
                  : currentSlide.product.image
              }
              alt={currentSlide.product.name}
              onError={() =>
                setImgError((prev) => ({ ...prev, [currentSlide.product.id]: true }))
              }
            />
          </div>
        </div>
      )}

      {totalSlides > 1 && (
        <div className="hero-carousel-nav">
          <button
            type="button"
            className="hero-nav-btn"
            onClick={() => setIndex((prev) => (prev - 1 + totalSlides) % totalSlides)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <div className="hero-nav-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hero-nav-dot ${i === index % totalSlides ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="hero-nav-btn"
            onClick={() => setIndex((prev) => (prev + 1) % totalSlides)}
            aria-label="Próximo"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
export default function Home() {
  const [allProducts, setAllProducts] = useState<Product[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((items: Product[]) => setAllProducts(items.filter((item) => item.active !== false)))
      .catch(() => undefined)
  }, [])

  const featured = allProducts.filter((item) => item.showInBanner || item.flashSale || (item.discountPercent && item.discountPercent > 0)).slice(0, 3)
  return <><section className="hero container"><div className="hero-copy"><p className="eyebrow">MANUTENÇÃO SEM PARAR</p><h1>Seu equipamento.<br /><em>Nosso compromisso.</em></h1><p>Peças e acessórios para manter sua academia sempre pronta para o próximo treino.</p><Link href="/products" className="primary-button">Explorar peças <span>→</span></Link></div><div className="hero-image"><HeroBanner products={allProducts} /></div></section><section className="trust-bar"><div className="container trust-grid"><div><b>Entrega para todo Brasil</b><span>Envio rápido e seguro</span></div><div><b>Compra protegida</b><span>Seus dados sempre seguros</span></div><div><b>Suporte especializado</b><span>Fale com quem entende</span></div><div><b>Peças de qualidade</b><span>Para você treinar tranquilo</span></div></div></section><section className="container content-section"><div className="section-heading"><div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div><Link href="/products">Ver todas <span>→</span></Link></div><div className="category-grid">{categories.map((category) => <Link className="category-card" href={`/products?category=${category.title.toLowerCase()}`} key={category.title}><img src={category.image} alt="" /><div><h3>{category.title}</h3><p>{category.detail}</p><span>Ver peças →</span></div></Link>)}</div></section><section className="featured-band"><div className="container"><div className="section-heading light"><div><p className="eyebrow">SELEÇÃO ALPHA TEC</p><h2>Produtos em destaque</h2></div><Link href="/products">Ver catálogo <span>→</span></Link></div><div className="product-grid">{featured.map((product) => <article className="product-card" key={product.id}><Link href={`/products/${product.id}`} className="product-image"><img src={product.image} alt={product.name} />{product.flashSale && <b>OFERTA RELÂMPAGO</b>}</Link><div className="product-info"><p>{product.brand || 'ALPHA TEC'}</p><h3>{product.name}</h3>{product.discountPercent ? <del>{formatPrice(product.price)}</del> : null}<strong>{formatPrice(product.price * (1 - (product.discountPercent || 0) / 100))}</strong><Link href={`/products/${product.id}`} className="product-button">Ver produto</Link></div></article>)}</div></div></section><section className="container service-callout"><div><p className="eyebrow">PRECISA DE AJUDA?</p><h2>Manutenção para o seu equipamento?</h2><p>Escolha entre visita sazonal ou contrato mensal e verifique a cobertura para seu endereço.</p></div><Link href="/maintenance" className="outline-button">Quero manutenção <span>→</span></Link></section></>
}
