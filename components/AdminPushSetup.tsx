import { useEffect, useState } from 'react'

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export default function AdminPushSetup() {
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState(false)

  async function saveSubscription(subscription: PushSubscription) {
    const response = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
    if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível sincronizar os alertas.')
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => setStatus('Não foi possível preparar o aplicativo neste navegador.'))
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription()
      setEnabled(Boolean(subscription))
      if (subscription) await saveSubscription(subscription)
    }).catch(() => setStatus('Não foi possível sincronizar os alertas deste celular.'))
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
    try {
      await saveSubscription(subscription)
    } catch (error) {
      return setStatus(error instanceof Error ? error.message : 'Não foi possível ativar os alertas.')
    }
    setEnabled(true)
    const testResponse = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
    if (!testResponse.ok) return setStatus((await testResponse.json()).error || 'Inscrição salva, mas o alerta de teste falhou.')
    setStatus('Alerta de teste enviado.')
  }

  async function testNotifications() {
    const response = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
    if (!response.ok) return setStatus((await response.json()).error || 'Não foi possível enviar o alerta de teste.')
    setStatus('Alerta de teste enviado.')
  }

  return <><button className={`admin-push-toggle ${enabled ? 'enabled' : ''}`} type="button" title={enabled ? 'Enviar alerta de teste' : 'Ativar alertas'} aria-label={enabled ? 'Enviar alerta de teste' : 'Ativar alertas'} onClick={() => void (enabled ? testNotifications() : enableNotifications())}><span className="bell-icon" aria-hidden="true" /></button>{status && <p className="admin-push-status" role="status">{status}</p>}</>
}
