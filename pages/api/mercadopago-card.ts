import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { createOrderFromPayment } from '../../lib/mercadopago-order'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) return res.status(503).json({ error: 'Mercado Pago não configurado.' })

  const { externalReference, token, installments, paymentMethodId, issuerId, payer } = req.body || {}
  if (!externalReference || !token || !paymentMethodId) {
    return res.status(400).json({ error: 'Dados do cartão incompletos.' })
  }

  const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!authToken) return res.status(401).json({ error: 'Autenticação necessária.' })

  try {
    const supabase = getSupabaseServer()
    const { data: authData, error: authError } = await supabase.auth.getUser(authToken)
    if (authError || !authData.user) return res.status(401).json({ error: 'Sessão inválida.' })

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,customer_id,total,payment_status')
      .eq('payment_reference', String(externalReference))
      .maybeSingle()

    if (orderError) throw orderError
    if (!order || order.customer_id !== authData.user.id) {
      return res.status(404).json({ error: 'Pedido não encontrado.' })
    }
    if (order.payment_status === 'paid') {
      return res.status(200).json({ confirmed: true, orderId: order.id })
    }

    const document = String(payer?.identification?.number || '').replace(/\D/g, '')
    // o valor vem sempre do pedido salvo, nunca do que o navegador enviou
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': String(externalReference),
      },
      body: JSON.stringify({
        transaction_amount: Number(Number(order.total).toFixed(2)),
        token,
        description: 'Pedido loja Alpha Tec',
        installments: Number(installments) || 1,
        payment_method_id: paymentMethodId,
        issuer_id: issuerId ? String(issuerId) : undefined,
        external_reference: String(externalReference),
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/mercadopago-webhook`,
        payer: {
          email: payer?.email,
          identification: document ? { type: payer?.identification?.type || (document.length > 11 ? 'CNPJ' : 'CPF'), number: document } : undefined,
        },
      }),
    })

    const payment = await paymentResponse.json()
    if (!paymentResponse.ok) {
      return res.status(502).json({ error: payment?.message || 'Não foi possível processar o pagamento.' })
    }

    const status = String(payment?.status || '').toLowerCase()
    if (status === 'approved') {
      const result = await createOrderFromPayment(payment)
      return res.status(200).json({ confirmed: true, orderId: 'orderId' in result ? result.orderId : order.id })
    }

    if (status === 'in_process' || status === 'pending') {
      return res.status(200).json({ confirmed: false, status, message: 'Pagamento em análise. Assim que for aprovado, seu pedido é confirmado automaticamente.' })
    }

    return res.status(200).json({ confirmed: false, status, message: rejectionMessage(String(payment?.status_detail || '')) })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível processar o pagamento.' })
  }
}

function rejectionMessage(statusDetail: string) {
  const messages: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Cartão sem limite suficiente.',
    cc_rejected_bad_filled_card_number: 'Número do cartão inválido.',
    cc_rejected_bad_filled_date: 'Data de validade inválida.',
    cc_rejected_bad_filled_security_code: 'Código de segurança inválido.',
    cc_rejected_call_for_authorize: 'Autorize o pagamento com o seu banco e tente novamente.',
    cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro cartão ou pague com Pix.',
    cc_rejected_card_disabled: 'Cartão desativado. Entre em contato com o banco emissor.',
  }
  return messages[statusDetail] || 'Pagamento recusado. Tente outro cartão ou pague com Pix.'
}
