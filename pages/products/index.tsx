import Link from 'next/link'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { hasProductCategory, products, type Product } from '../../lib/products'
import { equipmentCategories, partTypes } from '../../lib/product-taxonomy'
import { supabase } from '../../lib/supabase'
import ProductCard from '../../components/ProductCard'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')

const normalizeSearchText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function filterCatalog(items: Product[], category: string, selectedPartType: string, query: string) {
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
  const [catalog, setCatalog] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setCatalogError('')
    setCatalog([])
    fetch('/api/products', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catálogo: HTTP ${response.status}`)
        const databaseProducts: Product[] = await response.json()
        if (!Array.isArray(databaseProducts)) throw new Error('Resposta inválida do catálogo')
        const dbItems = databaseProducts
        const fallbackItems = Array.isArray(products) ? products : []
        const allProducts = [
          ...dbItems,
          ...fallbackItems.filter((fallback) => fallback && !dbItems.some((item) => item && item.id === fallback.id)),
        ].filter((p) => p && typeof p === 'object' && p.active !== false)

        setCatalog(filterCatalog(
          allProducts,
          String(router.query.category || ''),
          String(router.query.partType || ''),
          String(router.query.q || '')
        ))
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return
        console.error('Não foi possível carregar o catálogo', failure)
        setCatalogError('Não foi possível carregar as peças. Tente novamente para consultar preços e disponibilidade.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [router.query.category, router.query.partType, router.query.q, attempt])

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
  const filterHref = (key: 'category' | 'partType', value: string) => {
    const params = new URLSearchParams(queryParams)
    if (value) params.set(key, value)
    else params.delete(key)
    return `/products${params.size ? `?${params.toString()}` : ''}`
  }

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
      <div className="store-catalog-layout">
        <aside className="store-catalog-filters" aria-label="Filtros de peças">
          <h2>Encontre sua peça</h2>
          <button type="button" className="store-filter-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filter-options" onClick={() => setFiltersOpen((value) => !value)}>
            Filtrar por equipamento e peça <span>{filtersOpen ? '−' : '+'}</span>
          </button>
          <div id="catalog-filter-options" className={`store-filter-options${filtersOpen ? ' is-open' : ''}`}>
          <nav aria-label="Filtrar por equipamento">
            <h3>Equipamento</h3>
            <Link href={filterHref('category', '')} aria-current={!category ? 'true' : undefined}>Todos os equipamentos</Link>
            {equipmentCategories.map((item) => {
              const value = normalizeSearchText(item)
              return <Link href={filterHref('category', value)} key={value} aria-current={category === value ? 'true' : undefined}>{item}</Link>
            })}
            <Link href={filterHref('category', 'ofertas')} aria-current={category === 'ofertas' ? 'true' : undefined}>Ofertas</Link>
          </nav>
          <nav aria-label="Filtrar por tipo de peça">
            <h3>Tipo de peça</h3>
            <Link href={filterHref('partType', '')} aria-current={!selectedPartType ? 'true' : undefined}>Todos os tipos</Link>
            {partTypes.map((item) => <Link href={filterHref('partType', item.value)} key={item.value} aria-current={selectedPartType === item.value ? 'true' : undefined}>{item.label}</Link>)}
          </nav>
          {(category || selectedPartType || searchTerm) && <Link className="store-clear-filters" href="/products">Limpar filtros e busca</Link>}
          </div>
        </aside>
        <div className="store-catalog-results">
          <div className="store-catalog-summary">
            <span>{loading ? 'Carregando peças…' : catalogError ? 'Catálogo indisponível' : `${safeCatalog.length} ${safeCatalog.length === 1 ? 'peça encontrada' : 'peças encontradas'}`}</span>
            {searchTerm && <span>Busca: “{searchTerm}”</span>}
          </div>
          {catalogError ? (
            <div className="store-catalog-status" role="alert"><p>{catalogError}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div>
          ) : loading ? (
            <p className="store-catalog-status" role="status">Consultando preços e disponibilidade…</p>
          ) : safeCatalog.length ? (
            <div className="store-product-grid">{safeCatalog.map((product) => <ProductCard product={product} key={product.id} />)}</div>
          ) : (
            <div className="store-catalog-status"><p>Nenhuma peça encontrada com estes filtros.</p><Link href="/products">Ver catálogo completo</Link></div>
          )}
        </div>
      </div>
    </section>
    </>
  )
}
