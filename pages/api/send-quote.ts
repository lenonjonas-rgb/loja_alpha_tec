import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer'
import { storeConfig } from '../../lib/store-config'

type ResponseData = { sent?: boolean; configured?: boolean; error?: string }

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const { pdfBase64, customerName, cep, serviceType } = req.body || {}
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return res.status(200).json({ sent: false, configured: false })
  if (typeof pdfBase64 !== 'string') return res.status(400).json({ error: 'PDF inválido.' })

  try {
    const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } })
    await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: storeConfig.quoteEmailRecipients.join(', '), subject: `Novo orçamento Alpha Tec - ${customerName || 'cliente'}`, text: `Novo orçamento de ${serviceType || 'manutenção'} para ${customerName || 'cliente'}, CEP ${cep || 'não informado'}.`, attachments: [{ filename: `orcamento-alpha-tec-${cep || 'manutencao'}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }] })
    return res.status(200).json({ sent: true, configured: true })
  } catch { return res.status(502).json({ error: 'Não foi possível enviar o orçamento por e-mail.' }) }
}
