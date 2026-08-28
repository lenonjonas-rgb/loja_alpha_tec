import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { products } from '../../lib/products'
import { useCart } from '../../components/CartContext'

export default function ProductPage() {
  const router = useRouter()
  const productId = router.query.id
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [product, setProduct] = useState(products.find((item) => item.id === productId) || products[0])
  useEffect(() => { fetch('/api/products').then((response) => response.json()).then((databaseProducts) => { const databaseProduct = databaseProducts.find((item: { id: string }) => item.id === productId); if (databaseProduct) setProduct(databaseProduct); else { const catalogProduct = products.find((item) => item.id === productId); if (catalogProduct) setProduct(catalogProduct) } }).catch(() => undefined) }, [productId])

  if (!product) return <section className="container product-detail"><Link href="/products" className="back-link">← Voltar para produtos</Link><h1>Produto não encontrado</h1></section>

  return (
    <section className="container product-detail">
      <Link href="/products" className="back-link">← Voltar para produtos</Link>
      <div className="detail-layout">
        <div className="detail-image"><img src={product.image} alt={product.name} /></div>
        <div className="detail-copy">
          <p className="eyebrow">PEÇA ORIGINAL {product.brand || 'ALPHA TEC'}</p>
          <h1>{product.name}</h1>
          <p className="detail-code">Código do produto: AT-{productId || '001'}</p>
          <p className="detail-description">{product.description}</p>
          <p className="compatible-equipment"><strong>Equipamentos compatíveis</strong><br />{product.compatibleEquipment || 'Consulte a compatibilidade com nossa equipe.'}</p>
          {product.discountPercent ? <del className="detail-old-price">R$ {product.price.toFixed(2).replace('.', ',')}</del> : null}
          <strong className="detail-price">{product.price ? `R$ ${(product.price * (1 - (product.discountPercent || 0) / 100)).toFixed(2).replace('.', ',')}` : 'Consulte o preço'}</strong>
          <p className="stock-note">{product.stock === 0 ? 'Produto indisponível' : `${product.stock} unidades disponíveis`}</p>
          {product.price > 0 && (product.stock || 0) > 0 && <><button className="primary-button" type="button" onClick={() => { addItem({ ...product, price: product.price * (1 - (product.discountPercent || 0) / 100) }); setAdded(true) }}>{added ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'} <span>+</span></button>{added && <Link href="/cart" className="cart-after-add">Ir para o carrinho →</Link>}</>}
        </div>
      </div>
    </section>
  )
}
