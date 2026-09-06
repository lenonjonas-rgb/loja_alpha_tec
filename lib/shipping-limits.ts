export const CORREIOS_LIMITS = {
  maxWeightKg: 30,
  maxDimensionCm: 100,
  maxDimensionSumCm: 200,
} as const

type ShippingItem = {
  quantity?: number
  weightKg?: number
  heightCm?: number
  widthCm?: number
  lengthCm?: number
}

export function getCorreiosLimitViolation(items: ShippingItem[]) {
  let totalWeightKg = 0
  let totalDimensionSumCm = 0
  let largestDimensionCm = 0

  for (const item of items) {
    const quantity = Math.max(0, Number(item.quantity) || 0)
    const weightKg = Math.max(0, Number(item.weightKg) || 0)
    const heightCm = Math.max(0, Number(item.heightCm) || 0)
    const widthCm = Math.max(0, Number(item.widthCm) || 0)
    const lengthCm = Math.max(0, Number(item.lengthCm) || 0)
    totalWeightKg += weightKg * quantity
    totalDimensionSumCm += (heightCm + widthCm + lengthCm) * quantity
    largestDimensionCm = Math.max(largestDimensionCm, heightCm, widthCm, lengthCm)
  }

  if (totalWeightKg > CORREIOS_LIMITS.maxWeightKg) return 'O peso total ultrapassa o limite de 30 kg dos Correios.'
  if (largestDimensionCm > CORREIOS_LIMITS.maxDimensionCm) return 'Uma das dimensões ultrapassa o limite de 100 cm dos Correios.'
  if (totalDimensionSumCm > CORREIOS_LIMITS.maxDimensionSumCm) return 'A cubagem total ultrapassa o limite de 200 cm dos Correios.'
  return null
}
