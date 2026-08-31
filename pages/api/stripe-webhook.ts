import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { getStripe } from '../../lib/stripe'
import { createOrderFromStripeSession } from '../../lib/stripe-order'

export const config = {
  api: {
    bodyParser: false,
  },
}

function getRawBody(req: NextApiRequest) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const stripe = getStripe()
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe não configurado.' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const signature = req.headers['stripe-signature']
  if (!signature) {
    return res.status(400).json({ error: 'Assinatura do Stripe ausente.' })
  }

  try {
    const rawBody = await getRawBody(req)
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      await createOrderFromStripeSession(session)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook inválido.'
    return res.status(400).json({ error: message })
  }
}
