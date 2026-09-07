import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { isAdmin } from '../../lib/admin-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })

  const supabase = getSupabaseServer()
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('product_questions')
        .select('id,product_id,customer_id,question,answer,answered_at,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error

      const questions = data || []
      const productIds = Array.from(new Set(questions.map((item) => item.product_id)))
      const customerIds = Array.from(new Set(questions.map((item) => item.customer_id)))
      const [{ data: products }, { data: customers }] = await Promise.all([
        supabase.from('products').select('id,name').in('id', productIds.length ? productIds : ['']),
        supabase.from('customers').select('id,name,email').in('id', customerIds.length ? customerIds : ['']),
      ])
      const productById = new Map((products || []).map((product) => [String(product.id), product.name]))
      const customerById = new Map((customers || []).map((customer) => [String(customer.id), customer]))

      return res.status(200).json(questions.map((item) => ({
        ...item,
        productName: productById.get(String(item.product_id)) || 'Produto',
        customerName: customerById.get(String(item.customer_id))?.name || 'Cliente',
        customerEmail: customerById.get(String(item.customer_id))?.email || '',
      })))
    }

    if (req.method === 'POST') {
      const { id, answer } = req.body || {}
      const text = String(answer || '').trim()
      if (!id || text.length < 2) return res.status(400).json({ error: 'Escreva a resposta antes de enviar.' })

      const { data: question, error: questionError } = await supabase
        .from('product_questions')
        .update({ answer: text.slice(0, 1000), answered_at: new Date().toISOString() })
        .eq('id', id)
        .select('customer_id,question')
        .single()
      if (questionError) throw questionError

      await supabase.from('notifications').insert({
        customer_id: question.customer_id,
        title: 'Sua pergunta foi respondida',
        message: text.slice(0, 200),
        status: 'answered',
      }).then(() => undefined, () => undefined)

      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ error: 'Pergunta não informada.' })
      const { error } = await supabase.from('product_questions').delete().eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível processar a pergunta.' })
  }
}
