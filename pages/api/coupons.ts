import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const code = String(req.body?.code || '').trim().toUpperCase()
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (!code) return res.status(400).json({ error: 'Informe um cupom.' })
  try {
    const { data, error } = await getSupabaseServer()
      .from('coupons')
      .select('id,code,discount_percent,expires_at,usage_limit,used_count,product_id,category,free_shipping')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle()

    if (error && /product_id|category/i.test(error.message)) {
      const fallback = await getSupabaseServer()
        .from('coupons')
        .select('id,code,discount_percent,expires_at,usage_limit,used_count,product_id,category,free_shipping')
        .eq('code', code)
        .eq('active', true)
        .maybeSingle()
      if (fallback.error) throw fallback.error
      if (!fallback.data || (fallback.data.expires_at && new Date(fallback.data.expires_at) < new Date()) || (fallback.data.usage_limit !== null && fallback.data.used_count >= fallback.data.usage_limit)) {
        return res.status(404).json({ error: 'Cupom inválido, expirado ou esgotado.' })
      }
      if (fallback.data?.product_id) {
        if (items.length > 0) {
          const hasProduct = items.some((item: any) => String(item.id) === String(fallback.data?.product_id))
          if (!hasProduct) {
            return res.status(400).json({ error: 'Este cupom é exclusivo para um produto específico e ele não está no seu carrinho.' })
          }
        }
      }
      if (fallback.data?.category) {
        if (items.length > 0) {
          const hasCategory = items.some((item: any) => String(item.category || '').toLowerCase() === String(fallback.data?.category).toLowerCase())
          if (!hasCategory) {
            return res.status(400).json({ error: 'Este cupom é exclusivo para uma categoria e nenhum item do seu carrinho corresponde a ela.' })
          }
        }
      }
      return res.status(200).json({ code: fallback.data.code, discountPercent: Number(fallback.data.discount_percent || 0), freeShipping: Boolean(fallback.data.free_shipping), productId: fallback.data.product_id || undefined, category: fallback.data.category || undefined })
    }

    if (error) throw error
    if (!data || (data.expires_at && new Date(data.expires_at) < new Date()) || (data.usage_limit !== null && data.used_count >= data.usage_limit)) {
      return res.status(404).json({ error: 'Cupom inválido, expirado ou esgotado.' })
    }

    if (data.product_id) {
      if (items.length > 0) {
        const hasProduct = items.some((item: any) => String(item.id) === String(data.product_id))
        if (!hasProduct) {
          return res.status(400).json({ error: 'Este cupom é exclusivo para um produto específico e ele não está no seu carrinho.' })
        }
      }
      return res.status(200).json({
        code: data.code,
        discountPercent: Number(data.discount_percent || 0),
        freeShipping: Boolean(data.free_shipping),
        productId: data.product_id
      })
    }

    if (data.category) {
      if (items.length > 0) {
        const hasCategory = items.some((item: any) => String(item.category || '').toLowerCase() === String(data.category).toLowerCase())
        if (!hasCategory) {
          return res.status(400).json({ error: 'Este cupom é exclusivo para uma categoria e nenhum item do seu carrinho corresponde a ela.' })
        }
      }
      return res.status(200).json({
        code: data.code,
        discountPercent: Number(data.discount_percent || 0),
        freeShipping: Boolean(data.free_shipping),
        category: data.category
      })
    }

    return res.status(200).json({ code: data.code, discountPercent: Number(data.discount_percent || 0), freeShipping: Boolean(data.free_shipping) })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível validar o cupom.' })
  }
}
