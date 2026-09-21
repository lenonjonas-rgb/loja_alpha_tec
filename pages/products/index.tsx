import Link from 'next/link'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getProductCategories, hasProductCategory, products } from '../../lib/products'
import { supabase } from '../../lib/supabase'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')

const formatPrice = (price: any) => {
  const num = Number(price)
  return !isNaN(num) && num > 0 ? `R$ ${num.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
}

const salePrice = (product: any) => {
  const numPrice = Number(product?.price || 0)
  const discount = Number(product?.discountPercent || 0)
  return discount > 0 ? numPrice * (1 - discount / 100) : numPrice
}

export default function Products() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<any[]>(Array.isArray(products) ? products : [])

  useEffect(() => {
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : []))
      .then((databaseProducts) => {
        const dbItems = Array.isArray(databaseProducts) ? databaseProducts : []
        const fallbackItems = Array.isArray(products) ? products : []
        const allProducts = [
          ...dbItems,
          ...fallbackItems.filter((fallback) => fallback && !dbItems.some((item: any) => item && item.id === fallback.id)),
        ].filter((p) => p && typeof p === 'object' && p.active !== false)

        const category = String(router.query.category || '')
        const query = String(router.query.q || '')
        const normalize = (value: any) =>
          String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()

        let filtered = allProducts
        if (category === 'ofertas') {
          filtered = allProducts.filter(
            (p) => Boolean(p.flashSale) || Number(p.discountPercent || 0) > 0
          )
        } else if (category) {
          filtered = allProducts.filter((p) => hasProductCategory(p.category, category))
        }

        setCatalog(
          query
            ? filtered.filter((p) =>
                normalize(
                  [p.name, p.brand, p.category, p.compatibleEquipment, p.description].filter(Boolean).join(' ')
                ).includes(normalize(query))
              )
            : filtered
        )
      })
      .catch(() => setCatalog((Array.isArray(products) ? products : []).filter((p) => p && p.active !== false)))
  }, [router.query.category, router.query.q])

  useEffect(() => {
    const term = String(router.query.q || '').trim()
    if (!term || !supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token
      if (!token) return
      void fetch('/api/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ term }),
      }).catch(() => undefined)
    })
  }, [router.query.q])

  const safeCatalog = Array.isArray(catalog) ? catalog.filter(Boolean) : []
  const category = String(router.query.category || '')
  const searchTerm = String(router.query.q || '').trim()
  const normalizedSearchTerm = searchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const isMovementInverterSearch = normalizedSearchTerm.includes('inversor movement')
  const pageTitle = category
    ? category === 'ofertas'
      ? 'Ofertas em peças para academia e fitness - Alpha Tec'
      : `${category.charAt(0).toUpperCase() + category.slice(1)} | Peças para Academia e Fitness - Alpha Tec`
    : isMovementInverterSearch
      ? 'Inversor Movement para Esteira | Peças e Reposição - Alpha Tec'
      : searchTerm
      ? `Busca por "${searchTerm}" | Alpha Tec`
      : 'Peças para Esteira, Bicicleta, Elíptico e Musculação | Alpha Tec'

  const pageDescription = category
    ? `Encontre peças e acessórios para ${category} com qualidade e compatibilidade para sua academia ou equipamento fitness.`
    : isMovementInverterSearch
      ? 'Encontre inversor Movement para esteira e peças de reposição compatíveis na Alpha Tec. Consulte disponibilidade e envio para todo o Brasil.'
      : searchTerm
      ? `Resultados da busca por ${searchTerm} na Alpha Tec, loja de peças e acessórios para academia e fitness.`
      : 'Encontre peças para esteira, bicicletas, elipticos, musculação e manutenção de equipamentos fitness com entrega para todo o Brasil.'

  const canonicalUrl = `${siteUrl}/products${category ? `?category=${encodeURIComponent(category)}` : ''}${searchTerm ? `${category ? '&' : '?'}q=${encodeURIComponent(searchTerm)}` : ''}`

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
      </Head>
      <section className="catalog-page container">
      <div className="catalog-heading">
        <p className="eyebrow">CATÁLOGO ALPHA TEC</p>
        <h1>Peças para Esteira, Bicicleta, Elíptico e Musculação</h1>
        <p>Encontre peças, acessórios e reposição para seu equipamento de academia e fitness com qualidade e compatibilidade.</p>
      </div>
      {safeCatalog.length ? (
        <div className="catalog-grid">
          {safeCatalog.map((product) => {
            const isOutOfStock = product.stock === 0
            const hasDiscount = Number(product.discountPercent || 0) > 0
            return (
              <article className="catalog-card" key={product.id || Math.random()}>
                <Link href={`/products/${product.id || ''}`} className="catalog-card-image">
                  <img src={product.image || '/logo-header-uniform.jpg'} alt={product.name || 'Produto'} />
                  {product.flashSale && <b>OFERTA RELÂMPAGO</b>}
                  {!product.flashSale && hasDiscount && <b>OFERTA -{Number(product.discountPercent)}%</b>}
                </Link>
                <div className="catalog-card-body">
                  <small>{product.brand || 'Alpha Tec'} · {getProductCategories(product.category).join(' / ') || 'Geral'}</small>
                  <h2>{product.name || 'Produto'}</h2>
                  <p>{product.description || ''}</p>
                  {isOutOfStock ? (
                    <strong className="out-of-stock">Indisponível</strong>
                  ) : (
                    <>
                      {hasDiscount ? <del>{formatPrice(product.price)}</del> : null}
                      <strong>{formatPrice(salePrice(product))}</strong>
                      {typeof product.stock === 'number' && <small>{product.stock} em estoque</small>}
                    </>
                  )}
                  <Link href={`/products/${product.id || ''}`} className="product-button">
                    Ver detalhes
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="empty-catalog">Nenhuma peça cadastrada nesta categoria.</p>
      )}
    </section>
    </>
  )
}
