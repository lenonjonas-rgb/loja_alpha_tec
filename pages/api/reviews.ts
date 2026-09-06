import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseServer } from '../../lib/supabase-server'
import { POINTS_FOR_REVIEW, POINTS_PHOTO_BONUS, POINTS_EXPIRATION_DAYS } from '../../lib/loyalty'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

async function persistReviewPhoto(supabase: ReturnType<typeof getSupabaseServer>, orderId: string, index: number, photoBase64: string) {
  const match = photoBase64.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) throw new Error('As fotos precisam ser imagens válidas.')
  const bucket = 'review-photos'
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined)
  const extension = match[1].split('/')[1].replace('jpeg', 'jpg')
  const filePath = `${orderId}-${index}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, Buffer.from(match[2], 'base64'), { contentType: match[1], upsert: true })
  if (error) throw error
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`
}

function maskName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Cliente'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

// as avaliações são vinculadas ao pedido, então chega-se ao produto passando pelos itens do pedido
async function listProductReviews(res: NextApiResponse, productId: string) {
  const supabase = getSupabaseServer()

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId)
  if (itemsError) throw itemsError

  const orderIds = Array.from(new Set((orderItems || []).map((item) => item.order_id)))
  if (!orderIds.length) return res.status(200).json({ average: 0, total: 0, reviews: [] })

  const { data: reviews, error: reviewsError } = await supabase
    .from('product_reviews')
    .select('id,customer_id,rating,comment,photos,created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .limit(50)
  if (reviewsError) throw reviewsError

  const list = reviews || []
  if (!list.length) return res.status(200).json({ average: 0, total: 0, reviews: [] })

  const customerIds = Array.from(new Set(list.map((review) => review.customer_id)))
  const { data: customers } = await supabase.from('customers').select('id,name').in('id', customerIds)
  const nameById = new Map((customers || []).map((customer) => [String(customer.id), customer.name]))

  const average = list.reduce((sum, review) => sum + Number(review.rating || 0), 0) / list.length

  return res.status(200).json({
    average: Number(average.toFixed(1)),
    total: list.length,
    reviews: list.map((review) => ({
      id: review.id,
      rating: Number(review.rating || 0),
      comment: review.comment || '',
      photos: Array.isArray(review.photos) ? review.photos : [],
      createdAt: review.created_at,
      customerName: maskName(nameById.get(String(review.customer_id)) || ''),
    })),
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const productId = String(req.query.productId || '')
    if (!productId) return res.status(400).json({ error: 'Produto não informado.' })
    try {
      return await listProductReviews(res, productId)
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar as avaliações.' })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })

  const { orderId, rating, comment, photos } = req.body || {}
  const ratingNumber = Number(rating)
  if (!orderId || !Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
    return res.status(400).json({ error: 'Informe o pedido e uma nota de 1 a 5.' })
  }

  try {
    const supabase = getSupabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Sessão inválida.' })

    const { data: order, error: orderError } = await supabase.from('orders').select('id,customer_id,status').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order || order.customer_id !== user.id) return res.status(404).json({ error: 'Pedido não encontrado.' })
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Só é possível avaliar pedidos já entregues.' })

    const { data: existingReview } = await supabase.from('product_reviews').select('id').eq('order_id', orderId).maybeSingle()
    if (existingReview) return res.status(409).json({ error: 'Este pedido já foi avaliado.' })

    const photoList = Array.isArray(photos) ? photos.slice(0, 5) : []
    const photoUrls: string[] = []
    for (const [index, photo] of photoList.entries()) {
      photoUrls.push(await persistReviewPhoto(supabase, orderId, index, photo))
    }

    const pointsAwarded = POINTS_FOR_REVIEW + (photoUrls.length > 0 ? POINTS_PHOTO_BONUS : 0)

    const { data: review, error: reviewError } = await supabase.from('product_reviews').insert({
      order_id: orderId,
      customer_id: user.id,
      rating: ratingNumber,
      comment: typeof comment === 'string' ? comment.slice(0, 1000) : null,
      photos: photoUrls,
      points_awarded: pointsAwarded,
    }).select('id').single()
    if (reviewError) throw reviewError

    const expiresAt = new Date(Date.now() + POINTS_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error: pointsError } = await supabase.from('loyalty_points').insert({
      customer_id: user.id,
      order_id: orderId,
      points: pointsAwarded,
      reason: 'review',
      expires_at: expiresAt,
    })
    if (pointsError) throw pointsError

    return res.status(201).json({ reviewId: review.id, pointsAwarded, expiresAt })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível registrar sua avaliação.' })
  }
}
