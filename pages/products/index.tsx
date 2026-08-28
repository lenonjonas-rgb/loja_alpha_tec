import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { products } from '../../lib/products'

const formatPrice = (price: number) => price ? `R$ ${price.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
const salePrice = (product: typeof products[number]) => product.discountPercent ? product.price * (1 - product.discountPercent / 100) : product.price

export default function Products() {
  const router = useRouter()
  const [catalog, setCatalog] = useState(products)
  useEffect(() => { fetch('/api/products').then((response) => response.json()).then((databaseProducts) => { const allProducts = [...databaseProducts, ...products.filter((product) => !databaseProducts.some((item: { id: string }) => item.id === product.id))].filter((product) => product.active !== false); const category = String(router.query.category || ''); const query = String(router.query.q || ''); const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const filtered = category && category !== 'ofertas' ? allProducts.filter((product) => normalize(product.category) === normalize(category)) : allProducts; setCatalog(query ? filtered.filter((product) => normalize([product.name, product.brand || '', product.category, product.compatibleEquipment || '', product.description].join(' ')).includes(normalize(query))) : filtered) }).catch(() => setCatalog(products.filter((product) => product.active !== false))) }, [router.query.category, router.query.q])
  return <section className="catalog-page container">
    <div className="catalog-heading"><p className="eyebrow">CATÁLOGO ALPHA TEC</p><h1>Peças e acessórios</h1><p>Encontre componentes para manter seus equipamentos em movimento.</p></div>
    {catalog.length ? <div className="catalog-grid">{catalog.map((product) => <article className="catalog-card" key={product.id}><Link href={`/products/${product.id}`} className="catalog-card-image"><img src={product.image} alt={product.name} />{product.flashSale && <b>OFERTA RELÂMPAGO</b>}</Link><div className="catalog-card-body"><small>{product.brand || 'Alpha Tec'} · {product.category}</small><h2>{product.name}</h2><p>{product.description}</p>{product.stock === 0 ? <strong className="out-of-stock">Indisponível</strong> : <>{product.discountPercent ? <del>{formatPrice(product.price)}</del> : null}<strong>{formatPrice(salePrice(product))}</strong><small>{product.stock} em estoque</small></>}<Link href={`/products/${product.id}`} className="product-button">Ver detalhes</Link></div></article>)}</div> : <p className="empty-catalog">Nenhuma peça cadastrada nesta categoria.</p>}
  </section>
}
