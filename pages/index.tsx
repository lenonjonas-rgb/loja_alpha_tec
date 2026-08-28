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

function HeroCarousel({ items }: { items: Product[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [index])

  useEffect(() => {
    if (!items.length || paused) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [items.length, paused])

  if (!items.length) return null
  const current = items[index % items.length]
  const finalPrice = current.discountPercent
    ? current.price * (1 - current.discountPercent / 100)
    : current.price

  const badgeText = current.flashSale
    ? 'OFERTA RELÂMPAGO'
    : current.discountPercent
    ? `OFERTA -${current.discountPercent}%`
    : 'DESTAQUE DA SEMANA'

  return (
    <div
      className="hero-carousel-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link href={`/products/${current.id}`} className="hero-carousel-content">
        <div className="hero-carousel-img">
          <img
            src={imgError || !current.image ? '/logo-header-uniform.jpg' : current.image}
            alt={current.name}
            onError={() => setImgError(true)}
          />
        </div>
        <div className="hero-carousel-info">
          <span className="hero-badge">{badgeText}</span>
          <b className="hero-title">{current.name}</b>
          <div className="hero-prices">
            {Boolean(current.discountPercent) && (
              <del>{formatPrice(current.price)}</del>
            )}
            <strong>{formatPrice(finalPrice)}</strong>
          </div>
        </div>
      </Link>
      {items.length > 1 && (
        <div className="hero-carousel-controls">
          <button
            type="button"
            className="carousel-btn"
            onClick={(e) => {
              e.preventDefault()
              setIndex((prev) => (prev - 1 + items.length) % items.length)
            }}
            aria-label="Anterior"
          >
            ‹
          </button>
          <div className="carousel-dots">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`carousel-dot ${i === (index % items.length) ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setIndex(i)
                }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="carousel-btn"
            onClick={(e) => {
              e.preventDefault()
              setIndex((prev) => (prev + 1) % items.length)
            }}
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

  const bannerProducts = allProducts.filter(
    (item) => item.showInBanner || item.flashSale || (item.discountPercent && item.discountPercent > 0)
  )
  const carouselItems = bannerProducts.length > 0 ? bannerProducts : allProducts.slice(0, 5)
  const featured = allProducts.filter((item) => item.showInBanner || item.flashSale || (item.discountPercent && item.discountPercent > 0)).slice(0, 3)
  return <><section className="hero container"><div className="hero-copy"><p className="eyebrow">MANUTENÇÃO SEM PARAR</p><h1>Seu equipamento.<br /><em>Nosso compromisso.</em></h1><p>Peças e acessórios para manter sua academia sempre pronta para o próximo treino.</p><Link href="/products" className="primary-button">Explorar peças <span>→</span></Link></div><div className="hero-image"><HeroCarousel items={carouselItems} /><span className="hero-label">PERFORMANCE<br /><b>EM CADA DETALHE</b></span></div></section><section className="trust-bar"><div className="container trust-grid"><div><b>Entrega para todo Brasil</b><span>Envio rápido e seguro</span></div><div><b>Compra protegida</b><span>Seus dados sempre seguros</span></div><div><b>Suporte especializado</b><span>Fale com quem entende</span></div><div><b>Peças de qualidade</b><span>Para você treinar tranquilo</span></div></div></section><section className="container content-section"><div className="section-heading"><div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div><Link href="/products">Ver todas <span>→</span></Link></div><div className="category-grid">{categories.map((category) => <Link className="category-card" href={`/products?category=${category.title.toLowerCase()}`} key={category.title}><img src={category.image} alt="" /><div><h3>{category.title}</h3><p>{category.detail}</p><span>Ver peças →</span></div></Link>)}</div></section><section className="featured-band"><div className="container"><div className="section-heading light"><div><p className="eyebrow">SELEÇÃO ALPHA TEC</p><h2>Produtos em destaque</h2></div><Link href="/products">Ver catálogo <span>→</span></Link></div><div className="product-grid">{featured.map((product) => <article className="product-card" key={product.id}><Link href={`/products/${product.id}`} className="product-image"><img src={product.image} alt={product.name} />{product.flashSale && <b>OFERTA RELÂMPAGO</b>}</Link><div className="product-info"><p>{product.brand || 'ALPHA TEC'}</p><h3>{product.name}</h3>{product.discountPercent ? <del>{formatPrice(product.price)}</del> : null}<strong>{formatPrice(product.price * (1 - (product.discountPercent || 0) / 100))}</strong><Link href={`/products/${product.id}`} className="product-button">Ver produto</Link></div></article>)}</div></div></section><section className="container service-callout"><div><p className="eyebrow">PRECISA DE AJUDA?</p><h2>Manutenção para o seu equipamento?</h2><p>Escolha entre visita sazonal ou contrato mensal e verifique a cobertura para seu endereço.</p></div><Link href="/maintenance" className="outline-button">Quero manutenção <span>→</span></Link></section></>
}
