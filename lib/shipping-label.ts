import { storeConfig } from './store-config'

export type LabelAddress = { name?: string; document?: string; phone?: string; cep?: string; address?: string; number?: string; complement?: string; city?: string }
export type LabelCustomer = { name: string; email: string; phone: string; document?: string }
export type LabelOrder = {
  id: string
  carrier: string | null
  tracking_code: string | null
  total: number
  created_at: string
  shipping_address: LabelAddress | null
  customer_address?: LabelAddress | null
  customers: LabelCustomer | null
  order_items: { product_name: string; quantity: number }[]
}

// pedidos antigos não gravavam shipping_address: completa com o endereço cadastrado do cliente
export function resolveLabelAddress(order: { shipping_address: LabelAddress | null; customer_address?: LabelAddress | null; customers: LabelCustomer | null }): LabelAddress {
  const saved = order.shipping_address || {}
  const fallback = order.customer_address || {}
  const customer = order.customers
  return {
    name: saved.name || customer?.name,
    document: saved.document || customer?.document,
    phone: saved.phone || customer?.phone,
    cep: saved.cep || fallback.cep,
    address: saved.address || fallback.address,
    number: saved.number || fallback.number,
    complement: saved.complement || fallback.complement,
    city: saved.city || fallback.city,
  }
}

const formatCep = (cep: string) => {
  const digits = String(cep || '').replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : String(cep || '')
}

function splitCityState(city: string) {
  const [name, state] = String(city || '').split('/')
  return { city: (name || '').trim(), state: (state || '').trim() }
}

async function barcodeDataUrl(value: string, width: number) {
  const JsBarcode = (await import('jsbarcode')).default
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width })
  return canvas.toDataURL('image/png')
}

async function imageDataUrl(path: string) {
  const response = await fetch(path)
  if (!response.ok) throw new Error('Logo da loja não encontrada.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível carregar a logo da loja.'))
    reader.readAsDataURL(blob)
  })
}

export async function generateShippingLabel(order: LabelOrder) {
  const { jsPDF } = await import('jspdf')
  // formato único para Correios e demais transportadoras
  const pdf = new jsPDF({ unit: 'mm', format: [100, 150] })
  const destination = resolveLabelAddress(order)
  const { city, state } = splitCityState(destination.city || '')
  const recipientName = destination.name || order.customers?.name || 'Destinatário'
  const trackingCode = order.tracking_code || ''

  const margin = 6
  const width = 100 - margin * 2
  let y = margin

  pdf.setLineWidth(0.4)
  pdf.rect(margin - 2, margin - 2, width + 4, 150 - margin * 2 + 4)

  try {
    const logo = await imageDataUrl('/logo-header-uniform.jpg')
    pdf.addImage(logo, 'JPEG', margin, y, 29, 12, undefined, 'FAST')
  } catch {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.text('ALPHA TEC', margin, y + 7)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('ETIQUETA DE ENVIO', 100 - margin, y + 5, { align: 'right' })
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(String(order.carrier || 'Transportadora não informada').toUpperCase(), 100 - margin, y + 10, { align: 'right' })
  pdf.text(`Pedido #${order.id.slice(0, 8)}`, 100 - margin, y + 15, { align: 'right' })
  pdf.text(new Date(order.created_at).toLocaleDateString('pt-BR'), margin, y + 17)
  y += 21
  pdf.line(margin, y, 100 - margin, y)
  y += 4

  const codeForBarcode = trackingCode || order.id.replace(/-/g, '').slice(0, 20).toUpperCase()
  try {
    const barcode = await barcodeDataUrl(codeForBarcode, 2)
    pdf.addImage(barcode, 'PNG', margin, y, width, 16)
    y += 18
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(codeForBarcode, 50, y, { align: 'center' })
    y += 3
  } catch {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(codeForBarcode, margin, y + 5)
    y += 8
  }
  if (!trackingCode) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text('Código de rastreio ainda não informado — referência interna do pedido.', 50, y + 3.5, { align: 'center' })
    y += 5
  }

  y += 3
  pdf.line(margin, y, 100 - margin, y)
  y += 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('DESTINATÁRIO', margin, y)
  y += 5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(recipientName.toUpperCase().slice(0, 40), margin, y)
  y += 5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const streetLine = `${destination.address || ''}${destination.number ? `, ${destination.number}` : ''}${destination.complement ? ` - ${destination.complement}` : ''}`
  for (const line of pdf.splitTextToSize(streetLine || 'Endereço não informado', width)) {
    pdf.text(line, margin, y)
    y += 4.5
  }
  pdf.text(`${city || 'Cidade'}${state ? ` / ${state}` : ''}`, margin, y)
  y += 4.5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(`CEP: ${formatCep(destination.cep || '')}`, margin, y + 1)
  y += 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  if (destination.phone) { pdf.text(`Tel.: ${destination.phone}`, margin, y); y += 4 }
  if (destination.document) { pdf.text(`CPF/CNPJ: ${destination.document}`, margin, y); y += 4 }

  y += 2
  pdf.line(margin, y, 100 - margin, y)
  y += 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('REMETENTE', margin, y)
  y += 5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(storeConfig.legalName, margin, y)
  y += 4
  pdf.text(`CNPJ: ${storeConfig.document}`, margin, y)
  y += 4
  for (const line of pdf.splitTextToSize(`${storeConfig.address.street}, ${storeConfig.address.number} - ${storeConfig.address.neighborhood}`, width)) {
    pdf.text(line, margin, y)
    y += 4
  }
  pdf.text(`${storeConfig.address.city} / ${storeConfig.address.state} - CEP: ${formatCep(storeConfig.address.cep)}`, margin, y)
  y += 6

  pdf.line(margin, y, 100 - margin, y)
  y += 5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text('CONTEÚDO', margin, y)
  y += 4
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const content = order.order_items.map((item) => `${item.quantity}x ${item.product_name}`).join(' | ')
  for (const line of pdf.splitTextToSize(content || 'Peças e acessórios', width).slice(0, 4)) {
    pdf.text(line, margin, y)
    y += 4
  }

  pdf.setFontSize(7)
  pdf.text('Não aceite a encomenda se a embalagem estiver violada.', margin, 150 - margin - 2)

  pdf.save(`etiqueta-alpha-tec-${order.id.slice(0, 8)}.pdf`)
}
