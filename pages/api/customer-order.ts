import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { getStripe } from '../../lib/stripe'
import { createOrderFromPayment } from '../../lib/mercadopago-order'

async function getCustomer(req: NextApiRequest) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const user = await getCustomer(req)
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' })

    const { orderId, action } = req.body || {}
    if (!orderId || !['continue', 'cancel'].includes(action)) return res.status(400).json({ error: 'Pedido e ação são obrigatórios.' })

    const supabase = getSupabaseServer()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,customer_id,status,payment_status,payment_method,payment_reference,total')
      .eq('id', orderId)
      .eq('customer_id', user.id)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' })
    if (order.payment_status === 'paid') return res.status(400).json({ error: 'Este pedido já foi pago.' })
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Este pedido já foi cancelado.' })

    if (action === 'cancel') {
      const { error } = await supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', order.id)
      if (error) throw error
      return res.status(200).json({ cancelled: true })
    }

    if (order.payment_method === 'pix') {
      const accessToken = process.env.MP_ACCESS_TOKEN
      if (!accessToken) return res.status(503).json({ error: 'Mercado Pago não configurado.' })

      const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(order.payment_reference)}&sort=date_created&criteria=desc`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!searchResponse.ok) return res.status(502).json({ error: 'Não foi possível consultar o pagamento Pix.' })
      const searchData = await searchResponse.json()
      const payment = searchData?.results?.[0]
      if (!payment) return res.status(404).json({ error: 'Pagamento Pix não encontrado. Inicie um novo pedido.' })

      const confirmation = await createOrderFromPayment(payment)
      if (!('ignored' in confirmation)) return res.status(200).json({ confirmed: true, orderId: confirmation.orderId })

      const transactionData = payment?.point_of_interaction?.transaction_data
      if (!transactionData?.qr_code) return res.status(200).json({ status: payment.status, noQrCode: true })
      return res.status(200).json({ status: payment.status, pix: { paymentId: String(payment.id), qrCode: transactionData.qr_code, qrCodeBase64: transactionData.qr_code_base64 || '', expiresAt: payment.date_of_expiration || null } })
    }

    const stripe = getStripe()
    if (!stripe) return res.status(503).json({ error: 'Stripe não configurado.' })
    const session = await stripe.checkout.sessions.retrieve(String(order.payment_reference))
    if (session.payment_status === 'paid') {
      return res.status(200).json({ confirmed: true, orderId: order.id })
    }
    return res.status(200).json({ url: session.url, status: session.payment_status })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível processar o pedido.' })
  }
}
