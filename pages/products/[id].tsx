import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { products } from '../../lib/products'

export default function ProductPage() {
  const router = useRouter()
  const productId = router.query.id
  const [product, setProduct] = useState(products.find((item) => item.id === productId) || products[0])
  useEffect(() => { const customProducts = JSON.parse(localStorage.getItem('alpha-tec-admin-products') || '[]'); const customProduct = customProducts.find((item: { id: string }) => item.id === productId); if (customProduct) setProduct(customProduct); else { const catalogProduct = products.find((item) => item.id === productId); if (catalogProduct) setProduct(catalogProduct) } }, [productId])

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
          <strong className="detail-price">{product.price ? `R$ ${product.price.toFixed(2).replace('.', ',')}` : 'Consulte o preço'}</strong>
          <button className="primary-button" type="button">Adicionar ao carrinho <span>+</span></button>
        </div>
      </div>
    </section>
  )
}
