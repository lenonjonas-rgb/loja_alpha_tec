export type Product = {
  id: string
  name: string
  brand?: string
  category: string
  description: string
  price: number
  image: string
  compatibleEquipment?: string
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

import generatedProducts from './catalog.generated.json'

export const products: Product[] = generatedProducts as Product[]
