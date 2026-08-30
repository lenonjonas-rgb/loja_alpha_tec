import type { NextApiRequest, NextApiResponse } from 'next'
import { createOrderFromPayment } from '../../lib/mercadopago-order'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) return res.status(503).json({ error: 'Mercado Pago não configurado.' })

  const { paymentId } = req.body || {}
  if (!paymentId) return res.status(400).json({ error: 'paymentId é obrigatório.' })

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!paymentResponse.ok) {
      return res.status(502).json({ error: 'Não foi possível confirmar o pagamento com o Mercado Pago.' })
    }

    const payment = await paymentResponse.json()
    const result = await createOrderFromPayment(payment)

    if ('ignored' in result) {
      const status = String(payment?.status || '').toLowerCase()
      return res.status(200).json({ confirmed: false, status })
    }

    return res.status(200).json({ confirmed: true, orderId: result.orderId })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível confirmar o pedido.' })
  }
}
