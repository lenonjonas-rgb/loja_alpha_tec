const PENDING_KEY = 'alpha-tec-pending-payment'
const PENDING_TTL_MS = 2 * 60 * 60 * 1000
export type PendingPayment = { sessionId?: string; externalReference?: string; createdAt?: number }

export function readPendingPayment(): PendingPayment | null {
  try {
    const stored = localStorage.getItem(PENDING_KEY)
    if (!stored) return null
    const pending = JSON.parse(stored) as PendingPayment
    if (pending.createdAt && Date.now() - pending.createdAt > PENDING_TTL_MS) {
      clearPendingPayment()
      return null
    }
    return pending
  } catch {
    return null
  }
}

export function savePendingPayment(pending: PendingPayment) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...pending, createdAt: Date.now() })) } catch { /* ignora falha de storage */ }
}

export function clearPendingPayment() {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* ignora falha de storage */ }
}

export async function confirmPendingPayment(pending: PendingPayment): Promise<{ confirmed: boolean; orderId?: string }> {
  const endpoint = pending.sessionId ? '/api/stripe-confirm' : '/api/mercadopago-confirm'
  const body = pending.sessionId ? { sessionId: pending.sessionId } : { externalReference: pending.externalReference }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  return { confirmed: Boolean(result.confirmed), orderId: result.orderId }
}
