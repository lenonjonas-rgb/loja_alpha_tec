import Link from 'next/link'
import { useEffect, useState } from 'react'
import { products } from '../../lib/products'

const formatPrice = (price: number) => price ? `R$ ${price.toFixed(2).replace('.', ',')}` : 'Consulte o preço'

export default function Products() {
  const [catalog, setCatalog] = useState(products)
  useEffect(() => { const customProducts = JSON.parse(localStorage.getItem('alpha-tec-admin-products') || '[]'); setCatalog([...products, ...customProducts.filter((custom: { id: string }) => !products.some((product) => product.id === custom.id))]) }, [])
  return <section className="catalog-page container">
    <div className="catalog-heading"><p className="eyebrow">CATÁLOGO ALPHA TEC</p><h1>Peças e acessórios</h1><p>Encontre componentes para manter seus equipamentos em movimento.</p></div>
    <div className="catalog-grid">{catalog.map((product) => <article className="catalog-card" key={product.id}><Link href={`/products/${product.id}`} className="catalog-card-image"><img src={product.image} alt={product.name} /></Link><div className="catalog-card-body"><small>{product.brand || 'Alpha Tec'} · {product.category}</small><h2>{product.name}</h2><p>{product.description}</p><strong>{formatPrice(product.price)}</strong><Link href={`/products/${product.id}`} className="product-button">Ver detalhes</Link></div></article>)}</div>
  </section>
}
