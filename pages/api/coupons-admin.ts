import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

function isAdmin(req: NextApiRequest) {
  const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.')
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })
  const supabase = getSupabaseServer()
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
      if (error && /product_id/i.test(error.message)) {
        // Fallback se a coluna product_id ainda não existir na tabela
        const fallback = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
        if (fallback.error) throw fallback.error
        return res.status(200).json(fallback.data)
      }
      if (error) throw error
      return res.status(200).json(data)
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { code, discountPercent, expiresAt, usageLimit, productId, id, active } = req.body || {}
      const couponCode = String(code || '').trim().toUpperCase()
      const discount = Number(discountPercent)

      // Se for remoção ou inativação de cupom por produto com código vazio
      if (productId && !couponCode && discount <= 0) {
        const { data: existing } = await supabase.from('coupons').select('id').eq('product_id', String(productId)).maybeSingle()
        if (existing) {
          await supabase.from('coupons').delete().eq('id', existing.id)
        }
        return res.status(200).json({ message: 'Cupom removido.', productId })
      }

      if (!couponCode || discount <= 0 || discount > 100) {
        return res.status(400).json({ error: 'Informe um código de cupom válido e porcentagem entre 1% e 100%.' })
      }

      // Impede códigos duplicados para peças diferentes, porque a coluna code é única no banco.
      const { data: duplicateCoupon } = await supabase
        .from('coupons')
        .select('id, product_id')
        .eq('code', couponCode)
        .maybeSingle()

      if (duplicateCoupon && duplicateCoupon.id !== id && duplicateCoupon.product_id !== String(productId)) {
        return res.status(409).json({ error: `O código "${couponCode}" já está em uso por outra peça. Escolha outro código.` })
      }

      // Se for cupom de um produto específico
      if (productId) {
        // Verifica se já existe um cupom para este produto
        const { data: existingForProduct } = await supabase.from('coupons').select('*').eq('product_id', String(productId)).maybeSingle()

        if (existingForProduct) {
          const { data, error } = await supabase
            .from('coupons')
            .update({
              code: couponCode,
              discount_percent: discount,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
              usage_limit: usageLimit ? Number(usageLimit) : null,
              active: active !== undefined ? Boolean(active) : true
            })
            .eq('id', existingForProduct.id)
            .select('*')
            .single()

          if (error) throw error
          return res.status(200).json(data)
        }
      }

      // Se um ID de cupom direto foi informado para atualização
      if (id) {
        const { data, error } = await supabase
          .from('coupons')
          .update({
            code: couponCode,
            discount_percent: discount,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            usage_limit: usageLimit ? Number(usageLimit) : null,
            product_id: productId ? String(productId) : null,
            active: active !== undefined ? Boolean(active) : true
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw error
        return res.status(200).json(data)
      }

      // Senão, insere um novo cupom
      const { data, error } = await supabase
        .from('coupons')
        .insert({
          code: couponCode,
          discount_percent: discount,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          usage_limit: usageLimit ? Number(usageLimit) : null,
          product_id: productId ? String(productId) : null,
          active: true
        })
        .select('*')
        .single()

      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const { id, active } = req.body || {}
      const { data, error } = await supabase.from('coupons').update({ active: Boolean(active) }).eq('id', id).select('*').single()
      if (error) throw error
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('coupons').delete().eq('id', req.query.id)
      if (error) throw error
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Não foi possível gerenciar os cupons.'
    const duplicate = /duplicate|23505|unique/i.test(message)

    if (duplicate) {
      return res.status(409).json({ error: 'Esse código de cupom já existe. Escolha outro código para continuar.' })
    }

    return res.status(500).json({ error: message || 'Não foi possível gerenciar os cupons.' })
  }
}
