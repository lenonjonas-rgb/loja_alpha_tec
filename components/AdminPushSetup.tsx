import { useEffect, useState } from 'react'

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export default function AdminPushSetup() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => setStatus('Não foi possível preparar o aplicativo neste navegador.'))
    const captureInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    navigator.serviceWorker.ready.then(async (registration) => setEnabled(Boolean(await registration.pushManager.getSubscription()))).catch(() => undefined)
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
  }, [])

  async function install() {
    if (!installPrompt) return setStatus('Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.')
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

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

  return <section className="admin-mobile-tools" aria-label="Aplicativo e alertas">
    <div><strong>Painel no celular</strong><span>Instale e receba alertas de pedidos e novos leads.</span></div>
    <div className="admin-mobile-tool-actions"><button className="outline-button" type="button" onClick={() => void install()}>Instalar</button><button className="primary-button" type="button" disabled={enabled} onClick={() => void enableNotifications()}>{enabled ? 'Alertas ativos' : 'Ativar alertas'}</button></div>
    {status && <p className="form-hint">{status}</p>}
  </section>
}
