import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { products } from '../../lib/products'
import { useCart } from '../../components/CartContext'

const formatPrice = (price: any) => {
  const num = Number(price)
  return !isNaN(num) && num > 0 ? `R$ ${num.toFixed(2).replace('.', ',')}` : 'Consulte o preço'
}

type DetailTab = 'description' | 'specifications' | 'compatibility'

export default function ProductPage() {
  const router = useRouter()
  const productId = router.query.id
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('description')
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<any>(null)

  useEffect(() => {
    if (!router.isReady || !productId) return

    setLoading(true)
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : []))
      .then((databaseProducts) => {
        const dbItems = Array.isArray(databaseProducts) ? databaseProducts : []
        const fallbackItems = Array.isArray(products) ? products : []
        const foundDb = dbItems.find((item: any) => item && String(item.id) === String(productId))
        if (foundDb) {
          setProduct(foundDb)
        } else {
          const foundFallback = fallbackItems.find((item: any) => item && String(item.id) === String(productId))
          if (foundFallback) {
            setProduct(foundFallback)
          } else if (dbItems.length > 0) {
            setProduct(dbItems[0])
          }
        }
      })
      .catch(() => {
        const fallbackItems = Array.isArray(products) ? products : []
        const found = fallbackItems.find((item: any) => item && String(item.id) === String(productId))
        if (found) setProduct(found)
      })
      .finally(() => setLoading(false))
  }, [router.isReady, productId])

  if (loading && !product) {
    return (
      <section className="container product-detail">
        <Link href="/products" className="back-link">
          ← Voltar para produtos
        </Link>
        <div style={{ padding: '40px 0', color: '#686c70' }}>Carregando dados da peça...</div>
      </section>
    )
  }

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
  const specificationLines = (product.specifications || '')
    .split(/\n|\r\n|\;\s*/)
    .map((line: string) => line.trim())
    .filter(Boolean)

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

          <div className="detail-tabs" aria-label="Detalhes do produto">
            <button
              type="button"
              className={activeTab === 'description' ? 'active' : ''}
              onClick={() => setActiveTab('description')}
            >
              Descrição
            </button>
            <button
              type="button"
              className={activeTab === 'specifications' ? 'active' : ''}
              onClick={() => setActiveTab('specifications')}
            >
              Especificações
            </button>
            <button
              type="button"
              className={activeTab === 'compatibility' ? 'active' : ''}
              onClick={() => setActiveTab('compatibility')}
            >
              Compatibilidade
            </button>
          </div>

          <div className="detail-tab-panel">
            {activeTab === 'description' && (
              <p className="detail-description">{product.description || 'Descrição em breve.'}</p>
            )}
            {activeTab === 'specifications' && (
              <ul className="detail-spec-list">
                {specificationLines.length > 0 ? (
                  specificationLines.map((line: string) => <li key={line}>{line}</li>)
                ) : (
                  <li>As especificações do produto serão informadas em breve.</li>
                )}
              </ul>
            )}
            {activeTab === 'compatibility' && (
              <p className="detail-description">
                {product.compatibleEquipment || 'Consulte a compatibilidade com nossa equipe.'}
              </p>
            )}
          </div>

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
