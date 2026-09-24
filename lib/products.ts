export type Product = {
  id: string
  displayOrder?: number
  name: string
  internalCode?: string
  brand?: string
  category: string
  description: string
  specifications?: string
  price: number
  image: string
  compatibleEquipment?: string
  selectedModel?: string
  cartKey?: string
  active?: boolean
  stock?: number
  discountPercent?: number
  flashSale?: boolean
  showInBanner?: boolean
  weightKg?: number
  heightCm?: number
  widthCm?: number
  lengthCm?: number
}

export function getCompatibleModels(value?: string): string[] {
  return String(value || '')
    .split(/\r?\n|[;,]/)
    .map((model) => model.trim())
    .filter((model, index, models) => Boolean(model) && models.indexOf(model) === index)
}

export function getProductCategories(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((category) => category.trim())
    .filter((category, index, categories) => Boolean(category) && categories.indexOf(category) === index)
}

export function hasProductCategory(value: string | undefined, category: string): boolean {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return getProductCategories(value).some((item) => normalize(item) === normalize(category))
}

import generatedProducts from './catalog.generated.json'

export const products: Product[] = generatedProducts as Product[]
