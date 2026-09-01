// Regras do programa de pontos, calibradas para ficar entre o "cashback simbólico"
// e o "desconto agressivo" que grandes e-commerces (Magalu, Americanas, etc.) costumam praticar.
export const POINTS_FOR_REVIEW = 40 // pontos por avaliar o pedido (nota + comentário)
export const POINTS_PHOTO_BONUS = 20 // bônus por enviar ao menos 1 foto do produto recebido
export const POINT_VALUE_BRL = 0.02 // cada ponto vale R$ 0,02 de desconto
export const POINTS_EXPIRATION_DAYS = 90 // pontos expiram 90 dias após serem ganhos
export const MAX_REDEMPTION_PERCENT_OF_SUBTOTAL = 0.3 // desconto por pontos não pode passar de 30% do subtotal
export const MIN_POINTS_TO_REDEEM = 100 // resgate mínimo (R$ 2,00) para evitar descontos irrisórios
// taxa conservadora: 1 ponto a cada R$ 5 gastos (cashback efetivo de ~0,4%), calibrada para um catálogo com peças caras
export const REAIS_PER_PURCHASE_POINT = 5

export function purchasePointsPreview(subtotal: number) {
  return Math.floor(Math.max(0, subtotal) / REAIS_PER_PURCHASE_POINT)
}

export function pointsToDiscount(points: number) {
  return Math.round(points * POINT_VALUE_BRL * 100) / 100
}

export function maxRedeemablePoints(availablePoints: number, subtotal: number) {
  const capByOrder = Math.floor((subtotal * MAX_REDEMPTION_PERCENT_OF_SUBTOTAL) / POINT_VALUE_BRL)
  return Math.max(0, Math.min(availablePoints, capByOrder))
}
