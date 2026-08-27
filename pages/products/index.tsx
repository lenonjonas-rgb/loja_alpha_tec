import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { products } from '../../lib/products'

const formatPrice = (price: number) => price ? `R$ ${price.toFixed(2).replace('.', ',')}` : 'Consulte o preço'

export default function Products() {
  const router = useRouter()
  const [catalog, setCatalog] = useState(products)
  useEffect(() => { const customProducts = JSON.parse(localStorage.getItem('alpha-tec-admin-products-v2') || '[]'); const allProducts = [...products, ...customProducts.filter((custom: { id: string }) => !products.some((product) => product.id === custom.id))].filter((product) => product.active !== false); const category = String(router.query.category || ''); const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); setCatalog(category && category !== 'ofertas' ? allProducts.filter((product) => normalize(product.category) === normalize(category)) : allProducts) }, [router.query.category])
  return <section className="catalog-page container">
    <div className="catalog-heading"><p className="eyebrow">CATÁLOGO ALPHA TEC</p><h1>Peças e acessórios</h1><p>Encontre componentes para manter seus equipamentos em movimento.</p></div>
    {catalog.length ? <div className="catalog-grid">{catalog.map((product) => <article className="catalog-card" key={product.id}><Link href={`/products/${product.id}`} className="catalog-card-image"><img src={product.image} alt={product.name} /></Link><div className="catalog-card-body"><small>{product.brand || 'Alpha Tec'} · {product.category}</small><h2>{product.name}</h2><p>{product.description}</p><strong>{formatPrice(product.price)}</strong><Link href={`/products/${product.id}`} className="product-button">Ver detalhes</Link></div></article>)}</div> : <p className="empty-catalog">Nenhuma peça cadastrada nesta categoria.</p>}
  </section>
}
