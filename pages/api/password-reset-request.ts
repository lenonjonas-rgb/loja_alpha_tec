import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer'
import { getSupabaseServer } from '../../lib/supabase-server'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' })

  try {
    const supabase = getSupabaseServer()
    const { data: customer } = await supabase.from('customers').select('id,name,email').eq('email', email).maybeSingle()
    const genericMessage = 'Se o e-mail estiver cadastrado, você receberá um código de recuperação.'

    if (!customer) return res.status(200).json({ message: genericMessage })

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return res.status(503).json({ error: 'O envio de recuperação ainda não está configurado. Configure as variáveis SMTP.' })

    const code = String(crypto.randomInt(100000, 1000000))
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await supabase.from('password_reset_codes').delete().eq('customer_id', customer.id).is('used_at', null)
    const { error: insertError } = await supabase.from('password_reset_codes').insert({
      customer_id: customer.id,
      email,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    if (insertError) throw insertError

    const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } })
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: email,
      subject: 'Código para redefinir sua senha - Alpha Tec',
      text: `Olá${customer.name ? `, ${customer.name}` : ''}!\n\nSeu código para redefinir a senha é: ${code}\n\nEle expira em 15 minutos e pode ser usado uma única vez. Se você não solicitou essa alteração, ignore este e-mail.`,
    })

    return res.status(200).json({ message: genericMessage })
  } catch {
    return res.status(500).json({ error: 'Não foi possível enviar o código agora. Tente novamente em instantes.' })
  }
}
