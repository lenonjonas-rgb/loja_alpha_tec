import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { products } from '../../lib/products'

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
          ...fallbackItems.filter((fallback) => !dbItems.some((item: any) => item && item.id === fallback.id)),
        ].filter((product) => product && product.active !== false)

        const category = String(router.query.category || '')
        const query = String(router.query.q || '')
        const normalize = (value: string) =>
          value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

        const filtered =
          category && category !== 'ofertas'
            ? allProducts.filter((p) => normalize(p.category || '') === normalize(category))
            : allProducts

        setCatalog(
          query
            ? filtered.filter((p) =>
                normalize(
                  [p.name || '', p.brand || '', p.category || '', p.compatibleEquipment || '', p.description || ''].join(' ')
                ).includes(normalize(query))
              )
            : filtered
        )
      })
      .catch(() => setCatalog((Array.isArray(products) ? products : []).filter((p) => p && p.active !== false)))
  }, [router.query.category, router.query.q])

  return (
    <section className="catalog-page container">
      <div className="catalog-heading">
        <p className="eyebrow">CATÁLOGO ALPHA TEC</p>
        <h1>Peças e acessórios</h1>
        <p>Encontre componentes para manter seus equipamentos em movimento.</p>
      </div>
      {catalog.length ? (
        <div className="catalog-grid">
          {catalog.map((product) => {
            const isOutOfStock = product.stock === 0
            const hasDiscount = Number(product.discountPercent || 0) > 0
            return (
              <article className="catalog-card" key={product.id}>
                <Link href={`/products/${product.id}`} className="catalog-card-image">
                  <img src={product.image || '/logo-header-uniform.jpg'} alt={product.name || 'Produto'} />
                  {product.flashSale && <b>OFERTA RELÂMPAGO</b>}
                </Link>
                <div className="catalog-card-body">
                  <small>{product.brand || 'Alpha Tec'} · {product.category || 'Geral'}</small>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  {isOutOfStock ? (
                    <strong className="out-of-stock">Indisponível</strong>
                  ) : (
                    <>
                      {hasDiscount ? <del>{formatPrice(product.price)}</del> : null}
                      <strong>{formatPrice(salePrice(product))}</strong>
                      {typeof product.stock === 'number' && <small>{product.stock} em estoque</small>}
                    </>
                  )}
                  <Link href={`/products/${product.id}`} className="product-button">
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
  )
}
