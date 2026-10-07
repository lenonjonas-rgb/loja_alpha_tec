import Link from 'next/link'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getProductCategories, hasProductCategory, products } from '../../lib/products'
import { partTypes } from '../../lib/product-taxonomy'
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

const normalizeSearchText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function filterCatalog(items: any[], category: string, selectedPartType: string, query: string) {
  let filtered = items
  if (category === 'ofertas') {
    filtered = items.filter((product) => Boolean(product.flashSale) || Number(product.discountPercent || 0) > 0)
  } else if (category) {
    filtered = items.filter((product) => hasProductCategory(product.category, category))
  }

  if (selectedPartType) {
    filtered = filtered.filter((product) => product.partType === selectedPartType)
  }

  const normalizedQuery = normalizeSearchText(query)
  return normalizedQuery
    ? filtered.filter((product) =>
        normalizeSearchText([
          product.name,
          product.internalCode,
          product.manufacturerPartNumber,
          partTypes.find((partType) => partType.value === product.partType)?.label,
          product.partType,
          product.brand,
          product.category,
          product.compatibleEquipment,
          product.selectedModel,
          product.description,
          product.specifications,
        ].filter(Boolean).join(' ')).includes(normalizedQuery)
      )
    : filtered
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

        setCatalog(filterCatalog(
          allProducts,
          String(router.query.category || ''),
          String(router.query.partType || ''),
          String(router.query.q || '')
        ))
      })
      .catch(() => setCatalog(filterCatalog(
        (Array.isArray(products) ? products : []).filter((product) => product && product.active !== false),
        String(router.query.category || ''),
        String(router.query.partType || ''),
        String(router.query.q || '')
      )))
  }, [router.query.category, router.query.partType, router.query.q])

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
  const selectedPartType = String(router.query.partType || '')
  const selectedPartTypeLabel = partTypes.find((partType) => partType.value === selectedPartType)?.label
  const searchTerm = String(router.query.q || '').trim()
  const normalizedSearchTerm = searchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const isMovementInverterSearch = normalizedSearchTerm.includes('inversor movement')
  const pageTitle = selectedPartTypeLabel
    ? `${selectedPartTypeLabel} para equipamentos fitness | Alpha Tec`
    : category
    ? category === 'ofertas'
      ? 'Ofertas em peças para academia e fitness - Alpha Tec'
      : `${category.charAt(0).toUpperCase() + category.slice(1)} | Peças para Academia e Fitness - Alpha Tec`
    : isMovementInverterSearch
      ? 'Inversor Movement para Esteira | Peças e Reposição - Alpha Tec'
      : searchTerm
      ? `Busca por "${searchTerm}" | Alpha Tec`
      : 'Peças para Esteira, Bicicleta, Elíptico e Musculação | Alpha Tec'

  const pageDescription = selectedPartTypeLabel
    ? `Encontre ${selectedPartTypeLabel.toLowerCase()} para esteiras e equipamentos fitness na Alpha Tec. Confira os modelos compatíveis e consulte nossa equipe.`
    : category
    ? `Encontre peças e acessórios para ${category} com qualidade e compatibilidade para sua academia ou equipamento fitness.`
    : isMovementInverterSearch
      ? 'Encontre inversor Movement para esteira e peças de reposição compatíveis na Alpha Tec. Consulte disponibilidade e envio para todo o Brasil.'
      : searchTerm
      ? `Resultados da busca por ${searchTerm} na Alpha Tec, loja de peças e acessórios para academia e fitness.`
      : 'Encontre peças para esteira, bicicletas, elipticos, musculação e manutenção de equipamentos fitness com entrega para todo o Brasil.'

  const queryParams = new URLSearchParams()
  if (category) queryParams.set('category', category)
  if (selectedPartType) queryParams.set('partType', selectedPartType)
  if (searchTerm) queryParams.set('q', searchTerm)
  const canonicalUrl = `${siteUrl}/products${queryParams.size ? `?${queryParams.toString()}` : ''}`
  const catalogHeading = selectedPartTypeLabel
    ? `${selectedPartTypeLabel} para equipamentos fitness`
    : 'Peças para Esteira, Bicicleta, Elíptico e Musculação'

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
        <h1>{catalogHeading}</h1>
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
                  <small>{product.brand || 'Alpha Tec'} · {partTypes.find((partType) => partType.value === product.partType)?.label || 'Peça'} · {getProductCategories(product.category).join(' / ') || 'Geral'}</small>
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
