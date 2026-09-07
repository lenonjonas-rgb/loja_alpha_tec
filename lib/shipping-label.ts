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

async function drawShippingLabel(pdf: any, order: LabelOrder, x: number, y: number, labelWidth: number, labelHeight: number, logo: string | null) {
  const destination = resolveLabelAddress(order)
  const { city, state } = splitCityState(destination.city || '')
  const recipientName = destination.name || order.customers?.name || 'Destinatário'
  const trackingCode = order.tracking_code || ''
  const margin = 8
  const width = labelWidth - margin * 2
  let cursor = y + margin

  pdf.setLineWidth(0.4)
  pdf.rect(x + 2, y + 2, labelWidth - 4, labelHeight - 4)
  if (logo) pdf.addImage(logo, 'JPEG', x + margin, cursor, 38, 16, undefined, 'FAST')
  else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text('ALPHA TEC', x + margin, cursor + 10)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('ETIQUETA DE ENVIO', x + labelWidth - margin, cursor + 6, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(String(order.carrier || 'Transportadora não informada').toUpperCase(), x + labelWidth - margin, cursor + 12, { align: 'right' })
  pdf.text(`Pedido #${order.id.slice(0, 8)} · ${new Date(order.created_at).toLocaleDateString('pt-BR')}`, x + labelWidth - margin, cursor + 18, { align: 'right' })
  cursor += 24
  pdf.line(x + margin, cursor, x + labelWidth - margin, cursor)
  cursor += 6

  const codeForBarcode = trackingCode || order.id.replace(/-/g, '').slice(0, 20).toUpperCase()
  try {
    const barcode = await barcodeDataUrl(codeForBarcode, 1.5)
    pdf.addImage(barcode, 'PNG', x + margin, cursor, width, 20)
    cursor += 23
  } catch {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(codeForBarcode, x + margin, cursor + 8)
    cursor += 12
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(codeForBarcode, x + labelWidth / 2, cursor, { align: 'center' })
  cursor += 4
  if (!trackingCode) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text('Referência interna — rastreio oficial ainda não informado.', x + labelWidth / 2, cursor + 4, { align: 'center' })
    cursor += 7
  }

  cursor += 3
  pdf.line(x + margin, cursor, x + labelWidth - margin, cursor)
  cursor += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('DESTINATÁRIO', x + margin, cursor)
  cursor += 6
  pdf.setFontSize(13)
  pdf.text(recipientName.toUpperCase().slice(0, 42), x + margin, cursor)
  cursor += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const streetLine = `${destination.address || ''}${destination.number ? `, ${destination.number}` : ''}${destination.complement ? ` - ${destination.complement}` : ''}`
  for (const line of pdf.splitTextToSize(streetLine || 'Endereço não informado', width)) { pdf.text(line, x + margin, cursor); cursor += 5 }
  pdf.text(`${city || 'Cidade'}${state ? ` / ${state}` : ''}`, x + margin, cursor)
  cursor += 5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(`CEP: ${formatCep(destination.cep || '')}`, x + margin, cursor + 1)
  cursor += 9
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (destination.phone) { pdf.text(`Tel.: ${destination.phone}`, x + margin, cursor); cursor += 5 }
  if (destination.document) { pdf.text(`CPF/CNPJ: ${destination.document}`, x + margin, cursor); cursor += 5 }

  cursor += 3
  pdf.line(x + margin, cursor, x + labelWidth - margin, cursor)
  cursor += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('REMETENTE', x + margin, cursor)
  cursor += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(storeConfig.legalName, x + margin, cursor); cursor += 5
  pdf.text(`CNPJ: ${storeConfig.document}`, x + margin, cursor); cursor += 5
  for (const line of pdf.splitTextToSize(`${storeConfig.address.street}, ${storeConfig.address.number} - ${storeConfig.address.neighborhood}`, width)) { pdf.text(line, x + margin, cursor); cursor += 5 }
  pdf.text(`${storeConfig.address.city} / ${storeConfig.address.state} - CEP: ${formatCep(storeConfig.address.cep)}`, x + margin, cursor); cursor += 7
  pdf.line(x + margin, cursor, x + labelWidth - margin, cursor); cursor += 7
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('CONTEÚDO', x + margin, cursor); cursor += 5
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
  const content = order.order_items.map((item) => `${item.quantity}x ${item.product_name}`).join(' | ')
  for (const line of pdf.splitTextToSize(content || 'Peças e acessórios', width).slice(0, 3)) { pdf.text(line, x + margin, cursor); cursor += 5 }
  pdf.setFontSize(7)
  pdf.text('Não aceite a encomenda se a embalagem estiver violada.', x + margin, y + labelHeight - margin)
}

export async function generateShippingLabels(orders: LabelOrder[]) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const logo = await imageDataUrl('/logo-header-uniform.jpg').catch(() => null)
  const labelWidth = 148.5
  const labelHeight = 210
  for (let index = 0; index < orders.length; index += 1) {
    if (index > 0 && index % 2 === 0) pdf.addPage('a4', 'landscape')
    await drawShippingLabel(pdf, orders[index], (index % 2) * labelWidth, 0, labelWidth, labelHeight, logo)
  }
  pdf.save(`etiquetas-alpha-tec-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function generateShippingLabel(order: LabelOrder) {
  return generateShippingLabels([order])
}
