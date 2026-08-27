export type Product = {
  id: string
  name: string
  brand?: string
  category: string
  description: string
  price: number
  image: string
  compatibleEquipment?: string
}

import generatedProducts from './catalog.generated.json'

const manualProducts: Product[] = [
  {
    id: 'inversor-movement',
    name: 'Inversor Movement',
    brand: 'Movement',
    category: 'Esteiras',
    description: 'Inversor para equipamentos Movement. Confirme o modelo antes da compra.',
    price: 0,
    image: '/images/products/inversor.webp',
  },
  {
    id: 'rolamento-esteira',
    name: 'Rolamento para esteira',
    category: 'Esteiras',
    description: 'Peça de reposição para manutenção de esteiras.',
    price: 49.9,
    image: 'https://images.unsplash.com/photo-1597452485677-d661dfd0434d?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'parafuso-m8',
    name: 'Parafuso M8',
    category: 'Acessórios',
    description: 'Parafuso para montagem e manutenção de equipamentos.',
    price: 3.5,
    image: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=700&q=80',
  },
]

export const products: Product[] = [...(generatedProducts as Product[]), ...manualProducts.filter((manual) => !(generatedProducts as Product[]).some((generated) => generated.id === manual.id))]
