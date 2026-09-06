import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

const MAX_QUESTION_LENGTH = 500

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseServer()

  try {
    if (req.method === 'GET') {
      const productId = String(req.query.productId || '')
      const mine = String(req.query.mine || '') === '1'

      if (mine) {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
        if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

        const { data, error } = await supabase
          .from('product_questions')
          .select('id,product_id,question,answer,answered_at,created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json(await withProductNames(supabase, data || []))
      }

      if (!productId) return res.status(400).json({ error: 'Produto não informado.' })
      // publicamente só aparecem as perguntas já respondidas pela loja
      const { data, error } = await supabase
        .from('product_questions')
        .select('id,question,answer,answered_at,created_at')
        .eq('product_id', productId)
        .not('answer', 'is', null)
        .order('answered_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return res.status(200).json(data || [])
    }

    if (req.method === 'POST') {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) return res.status(401).json({ error: 'Entre na sua conta para enviar uma pergunta.' })

      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

      const { productId, question } = req.body || {}
      const text = String(question || '').trim()
      if (!productId || text.length < 5) {
        return res.status(400).json({ error: 'Escreva a sua pergunta com pelo menos 5 caracteres.' })
      }

      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count, error: countError } = await supabase
        .from('product_questions')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', user.id)
        .gte('created_at', since)
      if (countError) throw countError
      if ((count || 0) >= 10) {
        return res.status(429).json({ error: 'Você enviou muitas perguntas seguidas. Tente novamente mais tarde.' })
      }

      const { data, error } = await supabase
        .from('product_questions')
        .insert({ product_id: String(productId), customer_id: user.id, question: text.slice(0, MAX_QUESTION_LENGTH) })
        .select('id')
        .single()
      if (error) throw error

      return res.status(201).json({ id: data.id })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar as perguntas.' })
  }
}

async function withProductNames(supabase: ReturnType<typeof getSupabaseServer>, questions: Array<{ product_id: string }>) {
  const ids = Array.from(new Set(questions.map((item) => item.product_id)))
  if (!ids.length) return questions
  const { data: products } = await supabase.from('products').select('id,name').in('id', ids)
  const nameById = new Map((products || []).map((product) => [String(product.id), product.name]))
  return questions.map((item) => ({ ...item, productName: nameById.get(String(item.product_id)) || 'Produto' }))
}
