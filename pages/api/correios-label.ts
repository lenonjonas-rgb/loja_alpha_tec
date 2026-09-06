import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { createPrepostagem, downloadLabelPdf, getCorreiosConfig } from '../../lib/correios'

function isAdmin(req: NextApiRequest) {
  const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.')
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!getCorreiosConfig()) return res.status(503).json({ error: 'Integração dos Correios não configurada.', notConfigured: true })

  const { orderId } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'Pedido não informado.' })

  try {
    const supabase = getSupabaseServer()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,tracking_code,carrier,shipping_address,customers(name,email,phone,document,cep,address,number,complement,city),order_items(product_id,product_name,quantity,unit_price)')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' })

    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    // pedidos antigos não gravavam shipping_address: usa o endereço do cadastro do cliente
    const saved = (order.shipping_address || {}) as Record<string, string>
    const destination = {
      name: saved.name || customer?.name,
      document: saved.document || customer?.document,
      phone: saved.phone || customer?.phone,
      cep: saved.cep || customer?.cep,
      address: saved.address || customer?.address,
      number: saved.number || customer?.number,
      complement: saved.complement || customer?.complement,
      city: saved.city || customer?.city,
    }
    if (!destination.cep) return res.status(400).json({ error: 'Nem o pedido nem o cadastro do cliente têm CEP. Atualize o cadastro antes de gerar a etiqueta.' })

    const items = order.order_items || []

    // já existe rastreio: apenas rebaixa o rótulo em vez de criar outra pré-postagem
    if (order.tracking_code) {
      const pdfBase64 = await downloadLabelPdf(order.tracking_code)
      return res.status(200).json({ trackingCode: order.tracking_code, pdfBase64, reused: true })
    }

    const productIds = items.map((item) => item.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id,weight_kg,height_cm,width_cm,length_cm')
      .in('id', productIds.length ? productIds : [''])
    const productById = new Map((products || []).map((product) => [String(product.id), product]))

    let weightGrams = 0
    let heightCm = 0
    let widthCm = 2
    let lengthCm = 16
    for (const item of items) {
      const product = productById.get(String(item.product_id))
      const quantity = Number(item.quantity) || 1
      weightGrams += Number(product?.weight_kg || 0) * 1000 * quantity
      // empilhamento simples: soma as alturas e mantém a maior largura e comprimento
      heightCm += Number(product?.height_cm || 0) * quantity
      widthCm = Math.max(widthCm, Number(product?.width_cm || 0))
      lengthCm = Math.max(lengthCm, Number(product?.length_cm || 0))
    }

    const { codigoObjeto } = await createPrepostagem({
      destination,
      destinationEmail: customer?.email,
      pkg: { weightGrams: weightGrams || 300, heightCm: heightCm || 2, widthCm, lengthCm },
      items: items.map((item) => ({
        conteudo: String(item.product_name || 'Peça').slice(0, 60),
        quantidade: String(item.quantity || 1),
        valor: Number(item.unit_price || 0).toFixed(2),
      })),
      orderReference: `#${String(order.id).slice(0, 8)}`,
    })

    const { error: updateError } = await supabase.from('orders').update({ tracking_code: codigoObjeto }).eq('id', order.id)
    if (updateError) throw updateError

    const pdfBase64 = await downloadLabelPdf(codigoObjeto)
    return res.status(200).json({ trackingCode: codigoObjeto, pdfBase64 })
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível gerar a etiqueta dos Correios.' })
  }
}
