import { useEffect, useState } from 'react'

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export default function AdminPushSetup() {
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => setStatus('Não foi possível preparar o aplicativo neste navegador.'))
    navigator.serviceWorker.ready.then(async (registration) => setEnabled(Boolean(await registration.pushManager.getSubscription()))).catch(() => undefined)
  }, [])

  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return setStatus('Este navegador não oferece notificações para aplicativos.')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return setStatus('Permita as notificações nas configurações do navegador para receber os alertas.')
    const configResponse = await fetch('/api/admin/push')
    const config = await configResponse.json()
    if (!configResponse.ok || !config.configured) return setStatus(config.error || 'As chaves de notificação ainda não foram configuradas no servidor.')
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(config.publicKey) })
    const response = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
    if (!response.ok) return setStatus((await response.json()).error || 'Não foi possível ativar os alertas.')
    setEnabled(true)
    setStatus('Alertas ativos neste celular.')
  }

  return <><button className={`admin-push-toggle ${enabled ? 'enabled' : ''}`} type="button" title={enabled ? 'Alertas ativos' : 'Ativar alertas'} aria-label={enabled ? 'Alertas ativos' : 'Ativar alertas'} disabled={enabled} onClick={() => void enableNotifications()}><span className="bell-icon" aria-hidden="true" /></button>{status && <p className="admin-push-status" role="status">{status}</p>}</>
}
