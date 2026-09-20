export type Product = {
  id: string
  name: string
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

import generatedProducts from './catalog.generated.json'

export const products: Product[] = generatedProducts as Product[]
