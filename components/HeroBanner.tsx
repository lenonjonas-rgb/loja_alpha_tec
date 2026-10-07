import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '../lib/products'
import { formatProductPrice, getProductCompatibilityLabel, getProductSalePrice } from '../lib/product-presentation'
import ProductImage from './ProductImage'

export default function HeroBanner({ products, loading, error }: { products: Product[]; loading: boolean; error: string }) {
  const [index, setIndex] = useState(0)
  const slides = products.filter((product) => product.active !== false && product.showInBanner)
  const selectedIndex = slides.length ? index % slides.length : 0
  const product = slides[selectedIndex]

  if (!product) {
    return (
      <div className="technical-banner technical-banner-help">
        <span className="technical-banner-label">IDENTIFICAÇÃO DA PEÇA</span>
        <h2>A peça certa começa<br />pelo modelo certo.</h2>
        <p>{error || (loading ? 'Carregando peças selecionadas…' : 'Separe a marca, o modelo e uma foto da peça. Nossa equipe ajuda a conferir a aplicação antes da compra.')}</p>
        <Link href="/products" className="technical-banner-link">Consultar o catálogo <span>→</span></Link>
      </div>
    )
  }

  return (
    <section className="technical-banner" aria-label="Peças selecionadas pela Alpha Tec">
      <div className="technical-banner-top">
        <span className="technical-banner-label">SELEÇÃO ALPHA TEC</span>
        {slides.length > 1 && <span className="technical-banner-count">{selectedIndex + 1} / {slides.length}</span>}
      </div>
      <Link href={`/products/${product.id}`} className="technical-banner-image" aria-label={`Ver ${product.name}`}>
        <ProductImage src={product.image} name={product.name} eager />
      </Link>
      <div className="technical-banner-bottom">
        <div>
          <span className="technical-banner-brand">{product.brand || 'Alpha Tec'}</span>
          <h2><Link href={`/products/${product.id}`}>{product.name}</Link></h2>
          <p>{getProductCompatibilityLabel(product)}</p>
          <strong>{formatProductPrice(getProductSalePrice(product))}</strong>
          {product.stock === 0 && <small>Indisponível no momento</small>}
        </div>
        <Link href={`/products/${product.id}`} className="technical-banner-link">Ver peça <span>→</span></Link>
      </div>
      {slides.length > 1 && (
        <div className="technical-banner-controls">
          <button type="button" onClick={() => setIndex((selectedIndex + slides.length - 1) % slides.length)} aria-label="Peça anterior">←</button>
          <div>
            {slides.map((slide, slideIndex) => (
              <button key={slide.id} type="button" onClick={() => setIndex(slideIndex)} aria-label={`Mostrar ${slide.name}`} aria-pressed={slideIndex === selectedIndex} />
            ))}
          </div>
          <button type="button" onClick={() => setIndex((selectedIndex + 1) % slides.length)} aria-label="Próxima peça">→</button>
        </div>
      )}
    </section>
  )
}
