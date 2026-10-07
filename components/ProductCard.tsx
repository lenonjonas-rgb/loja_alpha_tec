import Link from 'next/link'
import { getProductCategories, type Product } from '../lib/products'
import { formatProductPrice, getProductCompatibilityLabel, getProductSalePrice } from '../lib/product-presentation'
import ProductImage from './ProductImage'

export default function ProductCard({ product }: { product: Product }) {
  const discount = Math.max(0, Math.min(100, Number(product.discountPercent) || 0))
  const unavailable = product.stock === 0

  return (
    <article className="store-product-card">
      <Link href={`/products/${product.id}`} className="store-product-image" aria-label={`Ver ${product.name}`}>
        <ProductImage src={product.image} name={product.name} />
        {unavailable
          ? <span className="store-product-badge is-unavailable">Indisponível</span>
          : discount > 0
            ? <span className="store-product-badge">{discount}% OFF</span>
            : product.flashSale && <span className="store-product-badge">Oferta</span>}
      </Link>
      <div className="store-product-content">
        <p className="store-product-brand">{product.brand || 'Alpha Tec'}<span>{getProductCategories(product.category).join(' / ')}</span></p>
        <h3><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
        {product.manufacturerPartNumber && <p className="store-product-code">Ref. fabricante: {product.manufacturerPartNumber}</p>}
        <p className="store-product-models"><b>Compatibilidade</b>{getProductCompatibilityLabel(product)}</p>
        <div className="store-product-purchase">
          {!unavailable && discount > 0 && <del>{formatProductPrice(Number(product.price))}</del>}
          <strong>{formatProductPrice(getProductSalePrice(product))}</strong>
          <small>{unavailable ? 'Consulte disponibilidade' : typeof product.stock === 'number' ? `${product.stock} em estoque` : 'Consulte estoque e prazo'}</small>
          <Link href={`/products/${product.id}`} className="store-product-button">Ver peça e compatibilidade <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  )
}
