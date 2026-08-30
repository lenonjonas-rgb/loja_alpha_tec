import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Product } from '../lib/products'

const categories = [
  { title: 'Esteiras', detail: 'Correias, roletes e placas', image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=800&q=80' },
  { title: 'Musculação', detail: 'Cabos, polias e estruturas', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80' },
  { title: 'Bicicletas', detail: 'Pedais, correias e sensores', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80' },
  { title: 'Acessórios', detail: 'Manoplas, parafusos e mais', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80' },
]

const formatPrice = (price: any) => {
  const num = Number(price)
  return !isNaN(num) && num > 0 ? `R$ ${num.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
}

function HeroBanner({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imgError, setImgError] = useState<Record<string, boolean>>({})

  const safeProducts = Array.isArray(products) ? products : []
  
  // REGRA ATUALIZADA: Puxa para o carrossel estritamente produtos com BANNER (showInBanner) marcado no Admin
  const offerProducts = safeProducts.filter(
    (item) => item && item.active !== false && Boolean(item.showInBanner)
  )

  type Slide = { type: 'default'; product: null } | { type: 'product'; product: Product }
  const slides: Slide[] = offerProducts.length
    ? [{ type: 'default', product: null }, ...offerProducts.map((p) => ({ type: 'product' as const, product: p }))]
    : []

  const totalSlides = slides.length

  useEffect(() => {
    if (paused || totalSlides <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % totalSlides)
    }, 4000)
    return () => clearInterval(timer)
  }, [totalSlides, paused])

  const safeIndex = totalSlides > 0 ? ((index % totalSlides) + totalSlides) % totalSlides : 0
  const currentSlide = totalSlides > 0 ? (slides[safeIndex] || slides[0]) : null

  if (offerProducts.length === 0 || !currentSlide || currentSlide.type === 'default' || !currentSlide.product) {
    return (
      <div className="hero-banner-single">
        <span className="hero-label">
          PERFORMANCE<br /><b>EM CADA DETALHE</b>
        </span>
      </div>
    )
  }

  const prod = currentSlide.product
  const priceNum = Number(prod.price || 0)
  const discountNum = Number(prod.discountPercent || 0)
  const finalPrice = discountNum > 0 ? priceNum * (1 - discountNum / 100) : priceNum

  return (
    <div
      className="hero-banner-carousel relative overflow-hidden rounded-2xl bg-neutral-950 p-6 sm:p-8 border border-neutral-800 shadow-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 min-h-[360px]">
        
        {/* Lado Esquerdo: Informações do Produto */}
        <div className="flex-1 flex flex-col items-start gap-3 z-10 w-full">
          <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold text-xs sm:text-sm uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md">
            {prod.flashSale
              ? '⚡ OFERTA RELÂMPAGO'
              : discountNum > 0
              ? `OFERTA -${discountNum}%`
              : 'DESTAQUE DA SEMANA'}
          </span>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mt-1">
            {prod.name || 'Produto'}
          </h2>

          <div className="flex items-baseline gap-3 my-1">
            {discountNum > 0 && (
              <del className="text-neutral-400 text-sm sm:text-base font-semibold">
                {formatPrice(priceNum)}
              </del>
            )}
            <strong className="text-3xl sm:text-4xl font-black text-red-500 tracking-tight">
              {formatPrice(finalPrice)}
            </strong>
          </div>

          <Link href={`/products/${prod.id}`} className="primary-button hero-product-btn mt-2 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md">
            Ver oferta <span>→</span>
          </Link>
        </div>

        {/* Lado Direito: Imagem do Produto */}
        <div className="w-full md:w-[50%] h-[280px] sm:h-[360px] rounded-2xl overflow-hidden border border-neutral-800 shadow-lg relative group">
          <img
            src={
              imgError[prod.id] || !prod.image
                ? '/logo-header-uniform.jpg'
                : prod.image
            }
            alt={prod.name || 'Produto'}
            onError={() => setImgError((prev) => ({ ...prev, [prod.id]: true }))}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
        </div>

      </div>

      {totalSlides > 1 && (
        <div className="hero-carousel-nav mt-4 flex items-center justify-between w-full pt-2 border-t border-neutral-800/60">
          <button
            type="button"
            className="hero-nav-btn text-white text-2xl px-3 py-1 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition"
            onClick={() => setIndex((prev) => ((prev - 1) % totalSlides + totalSlides) % totalSlides)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <div className="hero-nav-dots flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`w-3 h-3 rounded-full transition-all ${i === safeIndex ? 'bg-red-600 w-6' : 'bg-neutral-700 hover:bg-neutral-500'}`}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="hero-nav-btn text-white text-2xl px-3 py-1 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition"
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
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => {
        if (Array.isArray(items)) {
          setAllProducts(items.filter((item) => item && item.active !== false))
        } else {
          setAllProducts([])
        }
      })
      .catch(() => setAllProducts([]))
  }, [])

  const featured = Array.isArray(allProducts)
    ? allProducts
        .filter((item) => item && (Boolean(item.showInBanner) || Boolean(item.flashSale) || Number(item.discountPercent || 0) > 0))
        .slice(0, 3)
    : []

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">MANUTENÇÃO SEM PARAR</p>
          <h1>
            Seu equipamento.<br />
            <em>Nosso compromisso.</em>
          </h1>
          <p>Peças e acessórios para manter sua academia sempre pronta para o próximo treino.</p>
          <Link href="/products" className="primary-button">
            Explorar peças <span>→</span>
          </Link>
        </div>
        <div className="hero-image">
          <HeroBanner products={allProducts} />
        </div>
      </section>
      <section className="trust-bar">
        <div className="container trust-grid">
          <div><b>Entrega para todo Brasil</b><span>Envio rápido e seguro</span></div>
          <div><b>Compra protegida</b><span>Seus dados sempre seguros</span></div>
          <div><b>Suporte especializado</b><span>Fale com quem entende</span></div>
          <div><b>Peças de qualidade</b><span>Para você treinar tranquilo</span></div>
        </div>
      </section>
      <section className="container content-section">
        <div className="section-heading">
          <div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div>
          <Link href="/products">Ver todas <span>→</span></Link>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-card" href={`/products?category=${category.title.toLowerCase()}`} key={category.title}>
              <img src={category.image} alt="" />
              <div><h3>{category.title}</h3><p>{category.detail}</p><span>Ver peças →</span></div>
            </Link>
          ))}
        </div>
      </section>
      <section className="featured-band">
        <div className="container">
          <div className="section-heading light">
            <div><p className="eyebrow">SELEÇÃO ALPHA TEC</p><h2>Produtos em destaque</h2></div>
            <Link href="/products">Ver catálogo <span>→</span></Link>
          </div>
          <div className="product-grid">
            {featured.map((product) => {
              const priceNum = Number(product.price || 0)
              const discountNum = Number(product.discountPercent || 0)
              const finalPrice = discountNum > 0 ? priceNum * (1 - discountNum / 100) : priceNum
              return (
                <article className="product-card" key={product.id}>
                  <Link href={`/products/${product.id}`} className="product-image">
                    <img src={product.image || '/logo-header-uniform.jpg'} alt={product.name || 'Produto'} />
                    {product.flashSale && <b>OFERTA RELÂMPAGO</b>}
                  </Link>
                  <div className="product-info">
                    <p>{product.brand || 'ALPHA TEC'}</p>
                    <h3>{product.name}</h3>
                    {discountNum > 0 && <del>{formatPrice(priceNum)}</del>}
                    <strong>{formatPrice(finalPrice)}</strong>
                    <Link href={`/products/${product.id}`} className="product-button">Ver produto</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
      <section className="container service-callout">
        <div>
          <p className="eyebrow">PRECISA DE AJUDA?</p>
          <h2>Manutenção para o seu equipamento?</h2>
          <p>Escolha entre visita sazonal ou contrato mensal e verifique a cobertura para seu endereço.</p>
        </div>
        <Link href="/maintenance" className="outline-button">Quero manutenção <span>→</span></Link>
      </section>
    </>
  )
}