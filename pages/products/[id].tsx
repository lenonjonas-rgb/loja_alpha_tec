import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { products } from '../../lib/products'
import { useCart } from '../../components/CartContext'

const formatPrice = (price: any) => {
  const num = Number(price)
  return !isNaN(num) && num > 0 ? `R$ ${num.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
}

export default function ProductPage() {
  const router = useRouter()
  const productId = router.query.id
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [product, setProduct] = useState<any>(
    Array.isArray(products) ? products.find((item) => item && item.id === productId) || products[0] : null
  )

  useEffect(() => {
    if (!productId) return
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : []))
      .then((databaseProducts) => {
        const dbItems = Array.isArray(databaseProducts) ? databaseProducts : []
        const fallbackItems = Array.isArray(products) ? products : []
        const databaseProduct = dbItems.find((item: any) => item && item.id === productId)
        if (databaseProduct) {
          setProduct(databaseProduct)
        } else {
          const catalogProduct = fallbackItems.find((item) => item && item.id === productId)
          if (catalogProduct) setProduct(catalogProduct)
        }
      })
      .catch(() => undefined)
  }, [productId])

  if (!product) {
    return (
      <section className="container product-detail">
        <Link href="/products" className="back-link">
          ← Voltar para produtos
        </Link>
        <h1>Produto não encontrado</h1>
      </section>
    )
  }

  const priceNum = Number(product.price || 0)
  const discountNum = Number(product.discountPercent || 0)
  const finalPrice = discountNum > 0 ? priceNum * (1 - discountNum / 100) : priceNum
  const stockNum = typeof product.stock === 'number' ? product.stock : 1

  return (
    <section className="container product-detail">
      <Link href="/products" className="back-link">
        ← Voltar para produtos
      </Link>
      <div className="detail-layout">
        <div className="detail-image">
          <img src={product.image || '/logo-header-uniform.jpg'} alt={product.name || 'Produto'} />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">PEÇA ORIGINAL {product.brand || 'ALPHA TEC'}</p>
          <h1>{product.name}</h1>
          <p className="detail-code">Código do produto: AT-{productId || '001'}</p>
          <p className="detail-description">{product.description}</p>
          <p className="compatible-equipment">
            <strong>Equipamentos compatíveis</strong>
            <br />
            {product.compatibleEquipment || 'Consulte a compatibilidade com nossa equipe.'}
          </p>
          {discountNum > 0 && (
            <del className="detail-old-price">{formatPrice(priceNum)}</del>
          )}
          <strong className="detail-price">{formatPrice(finalPrice)}</strong>
          <p className="stock-note">
            {stockNum === 0 ? 'Produto indisponível' : `${stockNum} unidades disponíveis`}
          </p>
          {priceNum > 0 && stockNum > 0 && (
            <>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  addItem({ ...product, price: finalPrice })
                  setAdded(true)
                }}
              >
                {added ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'} <span>+</span>
              </button>
              {added && (
                <Link href="/cart" className="cart-after-add">
                  Ir para o carrinho →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
