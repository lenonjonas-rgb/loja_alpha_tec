import type { NextApiRequest, NextApiResponse } from 'next'
import { createOrderFromPayment } from '../../lib/mercadopago-order'

export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    return res.status(503).json({ error: 'Mercado Pago não configurado.' })
  }

  try {
    const event = req.body || {}
    // o Mercado Pago pode notificar via JSON (webhooks novos: data.id) ou via query string (IPN clássico: ?topic=payment&id=123)
    const topic = String(req.query.topic || req.query.type || event?.type || '')
    const paymentId = req.query.id || event?.data?.id || event?.id

    if (!paymentId || (topic && topic !== 'payment')) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!paymentResponse.ok) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const payment = await paymentResponse.json()
    await createOrderFromPayment(payment)

    return res.status(200).json({ received: true })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Webhook inválido.' })
  }
}
