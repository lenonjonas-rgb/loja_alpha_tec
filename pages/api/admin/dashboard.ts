import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRole } from '../../../lib/admin-auth'
import { getSupabaseServer } from '../../../lib/supabase-server'

type OrderRow = { created_at: string; status: string; payment_status: string; total: number; order_items: { product_id: string | null; product_name: string; quantity: number }[] | null }
type LeadRow = { created_at: string; service_type: string; status: string }
type CartRow = { items: unknown }
type PageResult<T> = { data: T[] | null; error: { message: string } | null }
type LocalDateParts = { year: number; month: number; day: number }

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) return rows
  }
}

function saoPauloDateParts(date: Date): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}

function localMidnightUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 3))
}

function monthKey(date: Date) {
  const { year, month } = saoPauloDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}`
}

function isPaidOrder(order: OrderRow) {
  return order.payment_status === 'paid' && order.status !== 'cancelled'
}

function summarizeOrders(orders: OrderRow[], start: Date) {
  const filteredOrders = orders.filter((order) => new Date(order.created_at) >= start)
  return {
    count: filteredOrders.length,
    revenue: filteredOrders.filter(isPaidOrder).reduce((sum, order) => sum + Number(order.total || 0), 0),
  }
}

function hasCartItems(items: unknown) {
  if (!Array.isArray(items)) return false
  return items.some((item) => {
    if (!item || typeof item !== 'object') return false
    const quantity = Number((item as Record<string, unknown>).quantity)
    return Number.isFinite(quantity) && quantity > 0
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  if (!requireRole(req, res, ['master', 'kiosk'])) return

  try {
    const now = new Date()
    const { year, month, day } = saoPauloDateParts(now)
    const localWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    const daysSinceMonday = (localWeekday + 6) % 7
    const weekStart = localMidnightUtc(year, month, day - daysSinceMonday)
    const monthStart = localMidnightUtc(year, month, 1)
    const yearStart = localMidnightUtc(year, 1, 1)
    const supabase = getSupabaseServer()
    const staleLeadThreshold = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const { error: staleLeadsError } = await supabase
      .from('leads')
      .update({ status: 'contact_lost', updated_at: now.toISOString() })
      .eq('status', 'new')
      .lt('updated_at', staleLeadThreshold)
    if (staleLeadsError) throw staleLeadsError

    const [orders, leads, carts] = await Promise.all([
      fetchAllPages<OrderRow>((from, to) => supabase
        .from('orders')
        .select('created_at,status,payment_status,total,order_items(product_id,product_name,quantity)')
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: true })
        .range(from, to)),
      fetchAllPages<LeadRow>((from, to) => supabase
        .from('leads')
        .select('created_at,service_type,status')
        .gte('created_at', yearStart.toISOString())
        .order('created_at', { ascending: true })
        .range(from, to)),
      fetchAllPages<CartRow>((from, to) => supabase
        .from('carts')
        .select('items')
        .range(from, to)),
    ])

    const currentYearOrders = orders.filter((order) => new Date(order.created_at) >= yearStart)
    const monthlyTrend = Array.from({ length: month }, (_, monthIndex) => {
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      return { key, label: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(Date.UTC(year, monthIndex, 15, 12))), orders: 0, revenue: 0 }
    })
    const trendByMonth = new Map(monthlyTrend.map((item) => [item.key, item]))
    const productUnits = new Map<string, { name: string; units: number }>()

    for (const order of currentYearOrders) {
      const trend = trendByMonth.get(monthKey(new Date(order.created_at)))
      if (trend) {
        trend.orders += 1
        if (isPaidOrder(order)) trend.revenue += Number(order.total || 0)
      }
      if (!isPaidOrder(order)) continue
      for (const item of order.order_items || []) {
        const name = String(item.product_name || '').trim()
        const quantity = Number(item.quantity) || 0
        if (!name || quantity <= 0) continue
        const key = String(item.product_id || name)
        const existing = productUnits.get(key)
        productUnits.set(key, { name, units: (existing?.units || 0) + quantity })
      }
    }

    const serviceTypeCounts = { technicalVisit: 0, monthlyContract: 0 }
    const leadStatusCounts = { won: 0, lost: 0, contactLost: 0 }
    for (const lead of leads) {
      const normalizedType = String(lead.service_type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      if (normalizedType.includes('visita')) serviceTypeCounts.technicalVisit += 1
      if (normalizedType.includes('contrato') || normalizedType.includes('mensal')) serviceTypeCounts.monthlyContract += 1
      if (lead.status === 'won') leadStatusCounts.won += 1
      if (lead.status === 'lost') leadStatusCounts.lost += 1
      if (lead.status === 'contact_lost') leadStatusCounts.contactLost += 1
    }

    return res.status(200).json({
      periods: {
        week: summarizeOrders(orders, weekStart),
        month: summarizeOrders(orders, monthStart),
        year: summarizeOrders(currentYearOrders, yearStart),
      },
      convertedOrders: currentYearOrders.filter(isPaidOrder).length,
      activeCarts: carts.filter((cart) => hasCartItems(cart.items)).length,
      leads: { total: leads.length, ...serviceTypeCounts, ...leadStatusCounts },
      topProducts: Array.from(productUnits.values()).sort((left, right) => right.units - left.units).slice(0, 5),
      monthlyTrend,
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o painel.' })
  }
}
