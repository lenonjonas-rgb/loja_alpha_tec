import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const customer = req.body || {}
  const email = String(customer.email || '').trim().toLowerCase()
  const password = String(customer.password || '')

  if (!customer.name || !email || !password || !customer.phone || !customer.cep || !customer.address || !customer.number || !customer.city) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios para criar seu cadastro.' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' })
  }

  try {
    const supabase = getSupabaseServer()
    const { data: createdUser, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { profile: customer }
    })

    if (userError || !createdUser.user) {
      if (/already|exists|registered/i.test(userError?.message || '')) {
        return res.status(409).json({ error: 'Este e-mail já possui cadastro. Entre na sua conta para continuar.' })
      }
      throw userError || new Error('Não foi possível criar o usuário.')
    }

    const user = createdUser.user
    const { data: savedCustomer, error: customerError } = await supabase
      .from('customers')
      .upsert({ id: user.id, name: customer.name, document: customer.document || null, email, phone: customer.phone || null }, { onConflict: 'id' })
      .select('id,name,document,email,phone')
      .single()

    if (customerError) throw customerError

    const [city, state] = String(customer.city).split('/')
    const { error: addressError } = await supabase
      .from('addresses')
      .insert({ customer_id: user.id, cep: customer.cep, street: customer.address, number: customer.number, complement: customer.complement || '', city: city || '', state: state || '' })

    if (addressError) throw addressError
    return res.status(201).json(savedCustomer)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível criar seu cadastro.' })
  }
}