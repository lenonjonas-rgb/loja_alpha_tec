import Link from 'next/link'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import type { Product } from '../lib/products'
import { getWhatsAppUrl } from '../lib/store-config'
import { partTypes } from '../lib/product-taxonomy'
import StoreReviews from '../components/StoreReviews'
import HeroBanner from '../components/HeroBanner'
import ProductCard from '../components/ProductCard'
import EquipmentIcon from '../components/EquipmentIcon'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')

const categories = [
  { title: 'Esteiras', detail: 'Correias, roletes e placas', slug: 'esteiras' },
  { title: 'Musculação', detail: 'Cabos, polias e estruturas', slug: 'musculacao' },
  { title: 'Bicicletas', detail: 'Pedais, correias e sensores', slug: 'bicicletas' },
  { title: 'Elípticos', detail: 'Pedaleiras, correias e sensores', slug: 'elipticos' },
  { title: 'Acessórios', detail: 'Manoplas, parafusos e mais', slug: 'acessorios' },
]

export default function Home() {
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const whatsappUrl = getWhatsAppUrl('Olá, preciso de ajuda para identificar uma peça ou confirmar a compatibilidade com meu equipamento.')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch('/api/products', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catálogo: HTTP ${response.status}`)
        const items: Product[] = await response.json()
        if (!Array.isArray(items)) throw new Error('Resposta inválida do catálogo')
        setAllProducts(items.filter((item) => item && item.active !== false))
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return
        console.error('Não foi possível carregar a vitrine', failure)
        setError('Não foi possível carregar as peças. Tente novamente ou consulte nossa equipe.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])

  const featured = allProducts.filter((item) => item.showInFeatured)

  return (
    <>
      <Head>
        <title>Inversor Movement e Peças para Esteira | Alpha Tec</title>
        <meta name="description" content="Encontre inversor Movement para esteira, peças e acessórios para equipamentos de academia na Alpha Tec, com envio para todo o Brasil." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />
        <meta property="og:title" content="Inversor Movement e Peças para Esteira | Alpha Tec" />
        <meta property="og:description" content="Encontre inversor Movement para esteira, peças e acessórios para equipamentos de academia na Alpha Tec, com envio para todo o Brasil." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
      </Head>
      <section className="store-hero container">
        <div className="store-hero-copy">
          <p className="eyebrow">PEÇAS TÉCNICAS E ASSISTÊNCIA FITNESS</p>
          <h1>A peça certa para<br /><em>seu equipamento.</em></h1>
          <p>Componentes para esteiras, bicicletas, elípticos e musculação. Confira o modelo e conte com ajuda técnica antes de comprar.</p>
          <Link href="/products" className="primary-button">Encontrar minha peça <span>→</span></Link>
          <a className="hero-support-link" href={whatsappUrl || '/maintenance'} target={whatsappUrl ? '_blank' : undefined} rel={whatsappUrl ? 'noopener noreferrer' : undefined}>
            {whatsappUrl ? 'Confirmar compatibilidade pelo WhatsApp' : 'Confirmar compatibilidade com um técnico'}
          </a>
          <div className="store-hero-tip"><b>Já sabe o que procura?</b><span>Use a busca por nome, referência do fabricante ou modelo.</span></div>
        </div>
        <HeroBanner products={allProducts} loading={loading} error={error} />
      </section>
      <section className="trust-bar">
        <div className="container trust-grid">
          <div><b>Peças para equipamentos fitness</b><span>Esteiras, bicicletas, elípticos e musculação</span></div>
          <div><b>Ajuda com compatibilidade</b><span>Consulte nossa equipe antes da compra</span></div>
          <div><b>Envio para todo o Brasil</b><span>Consulte prazo e frete no checkout</span></div>
          <div><b>Assistência técnica</b><span>Atendimento para equipamentos fitness</span></div>
        </div>
      </section>
      <section className="container content-section equipment-section">
        <div className="section-heading">
          <div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Peças por equipamento</h2></div>
          <Link href="/products">Ver todas <span>→</span></Link>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-card" href={`/products?category=${category.slug}`} key={category.slug}>
              <span className="category-card-mark"><EquipmentIcon category={category.slug} /></span>
              <div><h3>{category.title}</h3><p>{category.detail}</p><span>Ver peças →</span></div>
            </Link>
          ))}
        </div>
        <div className="part-type-section">
          <h3>Ou encontre pelo tipo de peça</h3>
          <div className="part-type-links">
            {partTypes.filter((partType) => partType.value !== 'outras-pecas').map((partType) => (
              <Link key={partType.value} href={`/products?partType=${partType.value}`}>{partType.label}</Link>
            ))}
          </div>
          <p>Pesquise também pela referência do fabricante, marca ou modelo do equipamento.</p>
        </div>
      </section>
      <section className="featured-band store-featured">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">SELEÇÃO ALPHA TEC</p><h2>Peças em destaque</h2></div>
            <Link href="/products">Ver catálogo <span>→</span></Link>
          </div>
          {error ? (
            <div className="store-catalog-status" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div>
          ) : loading ? (
            <p className="store-catalog-status" role="status">Carregando peças em destaque…</p>
          ) : featured.length ? (
            <div className="store-product-grid">{featured.map((product) => <ProductCard product={product} key={product.id} />)}</div>
          ) : (
            <p className="store-catalog-status">Veja as peças disponíveis no <Link href="/products">catálogo completo</Link>.</p>
          )}
        </div>
      </section>
      <section className="container service-callout" aria-labelledby="maintenance-callout-title">
        <div>
          <p className="eyebrow">ATENDIMENTO TÉCNICO</p>
          <h2 id="maintenance-callout-title">Seu equipamento precisa de manutenção?</h2>
          <p>Solicite uma visita técnica ou um contrato mensal. Consulte a cobertura pelo seu CEP e receba seu orçamento.</p>
        </div>
        <Link href="/maintenance" className="outline-button">Solicitar manutenção <span>→</span></Link>
      </section>
      <StoreReviews />
    </>
  )
}
