import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    __alphaTecReceiveNativePushToken?: (token: string) => void
    __alphaTecReceiveNativePushError?: (message: string) => void
  }
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export default function AdminPushSetup() {
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isNativeApp, setIsNativeApp] = useState(false)
  const registeredNativeToken = useRef('')

  async function saveSubscription(subscription: PushSubscription) {
    const response = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
    if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível sincronizar os alertas.')
  }

  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent))
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
    function handleInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    function handleAppInstalled() {
      setInstallPrompt(null)
      setIsStandalone(true)
      setStatus('Alpha Tec Admin instalado neste aparelho.')
    }
    const nativeBridge = window.ReactNativeWebView
    const receiveNativePushToken = (token: string) => {
      if (!token || token === registeredNativeToken.current) return
      void fetch('/api/admin/push/expo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token })
      }).then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível ativar as notificações do app.')
        registeredNativeToken.current = token
        setStatus('Notificações do app ativadas.')
      }).catch((error) => setStatus(error instanceof Error ? error.message : 'Não foi possível ativar as notificações do app.'))
    }
    const receiveNativePushError = (message: string) => setStatus(message)
    if (nativeBridge) {
      setIsNativeApp(true)
      window.__alphaTecReceiveNativePushToken = receiveNativePushToken
      window.__alphaTecReceiveNativePushError = receiveNativePushError
      nativeBridge.postMessage(JSON.stringify({ type: 'request-admin-push-token' }))
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    if (!nativeBridge && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => setStatus('Não foi possível preparar o aplicativo neste navegador.'))
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription()
        setEnabled(Boolean(subscription))
        if (subscription) await saveSubscription(subscription)
      }).catch(() => setStatus('Não foi possível sincronizar os alertas deste celular.'))
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (window.__alphaTecReceiveNativePushToken === receiveNativePushToken) delete window.__alphaTecReceiveNativePushToken
      if (window.__alphaTecReceiveNativePushError === receiveNativePushError) delete window.__alphaTecReceiveNativePushError
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return setStatus('No Chrome para Android, abra o menu ⋮ e escolha "Instalar app".')
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
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

  return <>{!isNativeApp && (installPrompt || (isAndroid && !isStandalone)) && <button className="admin-install-button" type="button" onClick={() => void installApp()}>Instalar app</button>}{!isNativeApp && <button className={`admin-push-toggle ${enabled ? 'enabled' : ''}`} type="button" title={enabled ? 'Enviar alerta de teste' : 'Ativar alertas'} aria-label={enabled ? 'Enviar alerta de teste' : 'Ativar alertas'} onClick={() => void (enabled ? testNotifications() : enableNotifications())}><span className="bell-icon" aria-hidden="true" /></button>}{status && <p className="admin-push-status" role="status">{status}</p>}</>
}
