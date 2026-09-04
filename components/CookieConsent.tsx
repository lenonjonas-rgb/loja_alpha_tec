import Link from 'next/link'
import { useEffect, useState } from 'react'

const consentKey = 'alpha-tec-cookie-consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(consentKey) !== 'accepted')
  }, [])

  function accept() {
    localStorage.setItem(consentKey, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return <aside className="cookie-consent" role="dialog" aria-label="Consentimento de cookies"><div><strong>Privacidade e cookies</strong><p>Usamos recursos necessários para manter o carrinho, a conta e o checkout funcionando. Não usamos cookies de publicidade ou rastreamento.</p><Link href="/privacidade">Saiba como tratamos seus dados</Link></div><button type="button" onClick={accept}>Entendi</button></aside>
}
