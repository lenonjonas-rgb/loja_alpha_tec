import { getCompatibleModels, type Product } from './products'

export const formatProductPrice = (price: number) =>
  Number.isFinite(price) && price > 0
    ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Consulte o preço'

export function getProductSalePrice(product: Product): number {
  const price = Number(product.price)
  const discount = Math.max(0, Math.min(100, Number(product.discountPercent) || 0))
  return price * (1 - discount / 100)
}

export function getProductCompatibilityLabel(product: Product): string {
  const models = getCompatibleModels(product.compatibleEquipment)
  if (!models.length) return 'Confirme a compatibilidade com nossa equipe.'
  const additional = models.length - 2
  return `${models.slice(0, 2).join(' / ')}${additional > 0 ? ` + ${additional} ${additional === 1 ? 'modelo' : 'modelos'}` : ''}`
}
