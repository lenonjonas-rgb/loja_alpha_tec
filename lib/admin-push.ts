import webpush from 'web-push'
import { getSupabaseServer } from './supabase-server'

type PushPayload = { title: string; body: string; url?: string }

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export async function sendAdminPush(payload: PushPayload) {
  if (!isConfigured()) return

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const supabase = getSupabaseServer()
  const { data: subscriptions } = await supabase.from('admin_push_subscriptions').select('id,subscription')
  if (!subscriptions?.length) return

  await Promise.all(subscriptions.map(async (item) => {
    try {
      await webpush.sendNotification(item.subscription, JSON.stringify({ ...payload, url: payload.url || '/admin' }))
    } catch (error) {
      const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0
      if (statusCode === 404 || statusCode === 410) await supabase.from('admin_push_subscriptions').delete().eq('id', item.id)
    }
  }))
}
