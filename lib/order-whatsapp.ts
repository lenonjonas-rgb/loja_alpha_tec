import { getCarrierTrackingUrl } from './carrier-tracking'
import { POINTS_FOR_REVIEW, POINTS_PHOTO_BONUS } from './loyalty'

type MessageOrder = {
  id: string
  status: string
  tracking_code: string | null
  carrier: string | null
  customer_id?: string | null
}

function storeUrl(path: string) {
  return `${(process.env.NEXT_PUBLIC_APP_URL || 'https://www.lojaalphatec.com.br').replace(/\/+$/, '')}${path}`
}

export function getCartRecoveryMessage(customerName: string | null, code: string): string {
  return `Olá${customerName?.trim() ? `, ${customerName.trim()}` : ''}! Seus produtos estão esperando por você na Alpha Tec!\n\nGanhe 10% de desconto com o cupom *${code}*, exclusivo para você e válido por 7 dias.\n\nConclua sua compra: ${storeUrl('/cart')}\n\nPrecisa de ajuda? É só responder!`
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  const international = /^\s*(?:\+|00)/.test(phone || '')
  let digits = (phone || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!international && (digits.length === 10 || digits.length === 11)) {
    if (!/^[1-9]{2}[2-9]\d{7,8}$/.test(digits)) return null
    digits = `55${digits}`
  }
  if (digits.startsWith('55') && !/^55[1-9]{2}[2-9]\d{7,8}$/.test(digits)) return null
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null
}

export function getOrderWhatsAppMessage(order: MessageOrder, customerName?: string | null): string | null {
  const greeting = `Olá${customerName?.trim() ? `, ${customerName.trim()}` : ''}!`
  const reference = `pedido #${order.id.slice(0, 8)}`
  let update: string
  switch (order.status) {
    case 'pending':
      update = `Seu ${reference} na Alpha Tec está pendente. Se precisar de ajuda para concluir a compra ou tiver alguma dúvida, estamos à disposição!`
      break
    case 'confirmed':
      update = `Obrigado pela compra e pela confiança na Alpha Tec! Seu ${reference} foi confirmado. Avisaremos você sobre os próximos passos, desde a separação até o envio e a entrega. Se precisar de ajuda, estamos à disposição!`
      break
    case 'processing':
      update = `Seu ${reference} na Alpha Tec está em separação! Estamos preparando seus produtos para o envio. Assim que o pedido for enviado, informaremos o rastreio.`
      break
    case 'shipped': {
      update = `Seu ${reference} na Alpha Tec foi enviado!`
      if (order.carrier) update += `\nTransportadora: ${order.carrier}.`
      if (order.tracking_code) update += `\nCódigo de rastreio: ${order.tracking_code}`
      const trackingUrl = getCarrierTrackingUrl(order.carrier, order.tracking_code)
      if (trackingUrl) update += `\nClique para rastrear ${order.tracking_code}: ${trackingUrl}`
      else if (order.tracking_code) update += '\nSe precisar do canal de rastreio da transportadora, fale conosco.'
      update += '\nSe precisar de ajuda, fale conosco!'
      break
    }
    case 'delivered':
      update = `Seu ${reference} na Alpha Tec consta como entregue! Esperamos que tenha recebido tudo certinho. Se houver qualquer problema ou se não tiver recebido, responda esta mensagem para ajudarmos. Obrigado por comprar com a Alpha Tec!`
      if (order.customer_id) {
        update += `\n\nConte como foi sua experiência! Avalie seu pedido com sinceridade e inclua uma foto do produto recebido: você ganha ${POINTS_FOR_REVIEW} pontos pela avaliação e mais ${POINTS_PHOTO_BONUS} pontos com foto, para usar conforme as regras do programa nas próximas compras. A pontuação independe da nota.\n\nAcesse Minha conta > Meus pedidos e escolha Avaliar pedido: ${storeUrl('/account')}`
      }
      break
    case 'cancelled':
      update = `Seu ${reference} na Alpha Tec foi cancelado. Se tiver alguma dúvida, estamos à disposição para ajudar.`
      break
    default:
      return null
  }
  return `${greeting}\n\n${update}`
}

export function getOrderWhatsAppUrl(order: MessageOrder, phone?: string | null, customerName?: string | null): string | null {
  const number = normalizeWhatsAppPhone(phone)
  const message = getOrderWhatsAppMessage(order, customerName)
  return number && message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}
