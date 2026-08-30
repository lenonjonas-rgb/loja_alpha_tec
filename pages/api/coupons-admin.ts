import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

function isCouponRuleColumnError(message: string) {
  return /product_id|category/i.test(message)
}

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
      const { code, discountPercent, expiresAt, usageLimit, productId, category, id, active, freeShipping } = req.body || {}
      const couponCode = String(code || '').trim().toUpperCase()
      const discount = Number(discountPercent || 0)
      const normalizedCategory = String(category || '').trim()
      const hasProductRule = Boolean(productId)
      const hasCategoryRule = Boolean(normalizedCategory)
      const freeShippingEnabled = Boolean(freeShipping)

      const supportsRuleColumns = async () => {
        const check = await supabase.from('coupons').select('id').limit(1)
        return !check.error || !isCouponRuleColumnError(check.error.message)
      }

      if (productId && category) {
        return res.status(400).json({ error: 'Selecione apenas um critério por cupom: produto ou categoria.' })
      }

      if (hasProductRule && !couponCode && discount <= 0) {
        const existingQuery = await supabase.from('coupons').select('id').eq('product_id', String(productId)).maybeSingle()
        if (existingQuery.error && !isCouponRuleColumnError(existingQuery.error.message)) throw existingQuery.error
        const existing = existingQuery.data
        if (existing) {
          await supabase.from('coupons').delete().eq('id', existing.id)
        }
        return res.status(200).json({ message: 'Cupom removido.', productId })
      }

      if (hasCategoryRule && !couponCode && discount <= 0) {
        const existingQuery = await supabase.from('coupons').select('id').eq('category', normalizedCategory).maybeSingle()
        if (existingQuery.error && !isCouponRuleColumnError(existingQuery.error.message)) throw existingQuery.error
        const existing = existingQuery.data
        if (existing) {
          await supabase.from('coupons').delete().eq('id', existing.id)
        }
        return res.status(200).json({ message: 'Cupom removido.', category: normalizedCategory })
      }

      if (freeShippingEnabled && normalizedCategory !== 'Frete') {
        return res.status(400).json({ error: 'Cupons de frete grátis devem usar a categoria "Frete".' })
      }

      if (!freeShippingEnabled && normalizedCategory === 'Frete') {
        return res.status(400).json({ error: 'A categoria "Frete" é exclusiva para cupons de frete grátis.' })
      }

      if (!couponCode || (!freeShippingEnabled && (discount <= 0 || discount > 100))) {
        return res.status(400).json({ error: freeShippingEnabled ? 'Informe um código de cupom válido para frete grátis.' : 'Informe um código de cupom válido e porcentagem entre 1% e 100%.' })
      }

      const duplicateQuery = await supabase
        .from('coupons')
        .select('id, product_id, category')
        .eq('code', couponCode)
        .maybeSingle()

      if (duplicateQuery.error && !isCouponRuleColumnError(duplicateQuery.error.message)) throw duplicateQuery.error
      const duplicateCoupon = duplicateQuery.data

      if (duplicateCoupon && duplicateCoupon.id !== id && duplicateCoupon.product_id !== String(productId) && duplicateCoupon.category !== normalizedCategory) {
        return res.status(409).json({ error: `O código "${couponCode}" já está em uso. Escolha outro código.` })
      }

      const ruleColumnsAvailable = await supportsRuleColumns()

      if (hasProductRule && ruleColumnsAvailable) {
        const existingQuery = await supabase.from('coupons').select('*').eq('product_id', String(productId)).maybeSingle()
        if (existingQuery.error && !isCouponRuleColumnError(existingQuery.error.message)) throw existingQuery.error
        const existingForProduct = existingQuery.data

        if (existingForProduct) {
          const { data, error } = await supabase
            .from('coupons')
            .update({
              code: couponCode,
              discount_percent: freeShippingEnabled ? 0 : discount,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
              usage_limit: usageLimit ? Number(usageLimit) : null,
              category: null,
              free_shipping: freeShippingEnabled,
              active: active !== undefined ? Boolean(active) : true
            })
            .eq('id', existingForProduct.id)
            .select('*')
            .single()

          if (error) throw error
          return res.status(200).json(data)
        }
      }

      if (hasCategoryRule && ruleColumnsAvailable) {
        const existingQuery = await supabase.from('coupons').select('*').eq('category', normalizedCategory).maybeSingle()
        if (existingQuery.error && !isCouponRuleColumnError(existingQuery.error.message)) throw existingQuery.error
        const existingForCategory = existingQuery.data

        if (existingForCategory) {
          const { data, error } = await supabase
            .from('coupons')
            .update({
              code: couponCode,
              discount_percent: freeShippingEnabled ? 0 : discount,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
              usage_limit: usageLimit ? Number(usageLimit) : null,
              product_id: null,
              category: normalizedCategory,
              free_shipping: freeShippingEnabled,
              active: active !== undefined ? Boolean(active) : true
            })
            .eq('id', existingForCategory.id)
            .select('*')
            .single()

          if (error) throw error
          return res.status(200).json(data)
        }
      }

      if (!ruleColumnsAvailable && (hasProductRule || hasCategoryRule)) {
        return res.status(400).json({ error: 'A tabela de cupons ainda não está com as colunas de critério por produto/categoria. Execute scripts/commerce.sql no Supabase para habilitar essa regra.' })
      }

      if (id) {
        const { data, error } = await supabase
          .from('coupons')
          .update({
            code: couponCode,
            discount_percent: freeShippingEnabled ? 0 : discount,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            usage_limit: usageLimit ? Number(usageLimit) : null,
            product_id: productId ? String(productId) : null,
            category: hasCategoryRule ? normalizedCategory : null,
            free_shipping: freeShippingEnabled,
            active: active !== undefined ? Boolean(active) : true
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw error
        return res.status(200).json(data)
      }

      const baseInsert = {
        code: couponCode,
        discount_percent: freeShippingEnabled ? 0 : discount,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        free_shipping: freeShippingEnabled,
        active: true
      }

      const insertPayload = ruleColumnsAvailable
        ? {
            ...baseInsert,
            product_id: productId ? String(productId) : null,
            category: hasCategoryRule ? normalizedCategory : null
          }
        : baseInsert

      const { data, error } = await supabase
        .from('coupons')
        .insert(insertPayload)
        .select('*')
        .single()

      if (error && isCouponRuleColumnError(error.message) && !ruleColumnsAvailable) {
        const fallback = await supabase
          .from('coupons')
          .insert(baseInsert)
          .select('*')
          .single()

        if (fallback.error) throw fallback.error
        return res.status(201).json(fallback.data)
      }

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
