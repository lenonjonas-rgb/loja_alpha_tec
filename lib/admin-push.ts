import webpush from 'web-push'
import { getSupabaseServer } from './supabase-server'

type PushPayload = { title: string; body: string; url?: string }

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export async function sendAdminPush(payload: PushPayload) {
  const supabase = getSupabaseServer()
  const { data: subscriptions } = await supabase.from('admin_push_subscriptions').select('id,endpoint,subscription')
  if (!subscriptions?.length) return { sent: 0, failed: 0 }

  const webSubscriptions = subscriptions.filter((item) => String(item.endpoint).startsWith('https://'))
  const expoSubscriptions = subscriptions.filter((item) => String(item.endpoint).startsWith('expo:'))
  let webResults: boolean[] = []
  if (isConfigured() && webSubscriptions.length) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    webResults = await Promise.all(webSubscriptions.map(async (item) => {
      try {
        await webpush.sendNotification(item.subscription, JSON.stringify({ ...payload, url: payload.url || '/admin' }))
        return true
      } catch (error) {
        const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0
        if (statusCode === 404 || statusCode === 410) await supabase.from('admin_push_subscriptions').delete().eq('id', item.id)
        console.error('Falha ao enviar notificação web push administrativa:', error)
        return false
      }
    }))
  }

  const expoResults = await Promise.all(expoSubscriptions.map(async (item) => {
    const token = String((item.subscription as { expoPushToken?: string } | null)?.expoPushToken || '')
    if (!token) return false
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: token, title: payload.title, body: payload.body, sound: 'default', priority: 'high', channelId: 'admin-events', data: { url: payload.url || '/admin' } })
      })
      const result = await response.json().catch(() => ({}))
      const ticket = Array.isArray(result.data) ? result.data[0] : result.data
      if (response.ok && ticket?.status === 'ok') return true
      if (ticket?.details?.error === 'DeviceNotRegistered') await supabase.from('admin_push_subscriptions').delete().eq('id', item.id)
      console.error('Falha ao enviar notificação Expo:', ticket?.message || response.statusText)
      return false
    } catch (error) {
      console.error('Falha ao enviar notificação Expo:', error)
      return false
    }
  }))

  const results = [...webResults, ...expoResults]
  return { sent: results.filter(Boolean).length, failed: results.filter((result) => !result).length }
}
