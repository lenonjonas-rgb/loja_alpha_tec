import type { NextApiRequest, NextApiResponse } from 'next'
import { getStripe } from '../../lib/stripe'
import { createOrderFromStripeSession } from '../../lib/stripe-order'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const stripe = getStripe()
  if (!stripe) return res.status(503).json({ error: 'Stripe não configurado.' })

  const { sessionId } = req.body || {}
  if (!sessionId) return res.status(400).json({ error: 'sessionId é obrigatório.' })

  try {
    const session = await stripe.checkout.sessions.retrieve(String(sessionId))
    const result = await createOrderFromStripeSession(session)

    if ('ignored' in result) {
      return res.status(200).json({ confirmed: false, status: session.payment_status })
    }

    return res.status(200).json({ confirmed: true, orderId: result.orderId })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível confirmar o pedido.' })
  }
}
