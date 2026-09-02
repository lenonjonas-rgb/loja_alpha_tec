import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'
import { readPendingPayment, savePendingPayment, clearPendingPayment } from '../lib/pending-payment'
import { maxRedeemablePoints, pointsToDiscount, purchasePointsPreview } from '../lib/loyalty'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`

type PixData = { paymentId: string; qrCode: string; qrCodeBase64: string; expiresAt: string | null; externalReference: string }

export default function Checkout() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()
  const { customer } = useCustomer()
  const [shipping] = useState(Number(router.query.shipping || 41.09))
  const [carrier] = useState(String(router.query.carrier || 'Correios'))
  const [shippingDeadline] = useState(String(router.query.deadline || 'A calcular'))
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmedOrderId, setConfirmedOrderId] = useState('')
  const [awaitingPayment, setAwaitingPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix')
  const [couponCode, setCouponCode] = useState(String(router.query.coupon || ''))
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number; freeShipping: boolean } | null>(null)
  const [availablePoints, setAvailablePoints] = useState(0)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [pixData, setPixData] = useState<PixData | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [pixSecondsLeft, setPixSecondsLeft] = useState(0)
  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=checkout') }, [customer, router])
  useEffect(() => {
    const couponFromQuery = typeof router.query.coupon === 'string' ? router.query.coupon : ''
    if (!couponFromQuery) return
    setCouponCode(couponFromQuery)
    void applyCoupon(couponFromQuery)
  }, [router.query.coupon])

  useEffect(() => {
    async function loadPoints() {
      if (!supabase || !customer) return
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch('/api/loyalty-points', { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) { const result = await response.json(); setAvailablePoints(Number(result.points) || 0) }
    }
    void loadPoints()
  }, [customer])

  // enquanto o QR Code do Pix está na tela, verifica a cada poucos segundos se o pagamento já foi aprovado
  useEffect(() => {
    if (!pixData) return
    const interval = setInterval(() => {
      fetch('/api/mercadopago-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalReference: pixData.externalReference }) })
        .then((response) => response.json())
        .then((result) => {
          if (result.confirmed) {
            setConfirmedOrderId(result.orderId)
            setPixData(null)
            clearCart()
            clearPendingPayment()
          }
        })
        .catch(() => undefined)
    }, 4000)
    return () => clearInterval(interval)
  }, [pixData])

  useEffect(() => {
    if (!pixData?.expiresAt) return setPixSecondsLeft(0)
    const expiresAtMs = new Date(pixData.expiresAt).getTime()
    const tick = () => setPixSecondsLeft(Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [pixData])

  function copyPixCode() {
    if (!pixData) return
    navigator.clipboard?.writeText(pixData.qrCode).then(() => {
      setPixCopied(true)
      setTimeout(() => setPixCopied(false), 2500)
    }).catch(() => undefined)
  }

  function checkPendingPayment(silent = false) {
    if (!router.isReady) return
    const sessionId = String(router.query.session_id || '') || readPendingPayment()?.sessionId || ''
    const externalReference = readPendingPayment()?.externalReference || ''
    const paymentId = String(router.query.payment_id || router.query.collection_id || '')
    if (!sessionId && !paymentId && !externalReference) return

    const endpoint = sessionId ? '/api/stripe-confirm' : '/api/mercadopago-confirm'
    const body = sessionId ? { sessionId } : paymentId ? { paymentId } : { externalReference }
    const maxAttempts = silent ? 1 : 5

    setConfirming(true)
    setAwaitingPayment(false)
    const tryConfirm = (attempt: number) => {
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then((response) => response.json())
        .then((result) => {
          if (result.confirmed) {
            setConfirmedOrderId(result.orderId)
            clearCart()
            clearPendingPayment()
            setConfirming(false)
          } else if (attempt < maxAttempts) {
            setTimeout(() => tryConfirm(attempt + 1), 3000)
          } else {
            setError('Pagamento ainda n\u00e3o foi aprovado. Assim que for confirmado, clique em "Verificar pagamento" novamente.')
            setAwaitingPayment(true)
            setConfirming(false)
          }
        })
        .catch(() => {
          setError('N\u00e3o foi poss\u00edvel confirmar automaticamente o pagamento. Clique em "Verificar pagamento" para tentar de novo.')
          setAwaitingPayment(true)
          setConfirming(false)
        })
    }
    tryConfirm(1)
  }

  useEffect(() => {
    if (!router.isReady) return
    const paymentStatus = String(router.query.payment || '')
    if (paymentStatus === 'success') {
      checkPendingPayment()
    } else if (paymentStatus === 'cancelled') {
      setError('Pagamento cancelado ou n\u00e3o conclu\u00eddo. Voc\u00ea pode tentar novamente.')
    } else if (readPendingPayment()) {
      // usu\u00e1rio voltou para a loja sem passar pela URL de retorno (ex: fechou a aba do Mercado Pago): verifica mesmo assim
      checkPendingPayment()
    }
  }, [router.isReady, router.query.payment])
  async function applyCoupon(codeToApply = couponCode) { const response = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeToApply, items }) }); const result = await response.json(); if (!response.ok) return setError(result.error); setCoupon({ code: result.code, discountPercent: Number(result.discountPercent) || 0, freeShipping: Boolean(result.freeShipping) }); setError(result.freeShipping ? 'Cupom aplicado: frete grátis.' : 'Cupom aplicado.') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!customer?.id) return setError('Sua conta precisa ser cadastrada novamente para continuar.')
    if (!supabase) return setError('Serviço de autenticação não configurado.')
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session) return setError('Sua sessão expirou. Entre novamente na conta.')

      const effectiveShipping = coupon?.freeShipping ? 0 : shipping

      const response = await fetch('/api/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          customerId: customer.id,
          items,
          shipping: effectiveShipping,
          carrier,
          couponCode: coupon?.code,
          paymentMethod,
          pointsToRedeem,
          successUrl: `${window.location.origin}/checkout?payment=success`,
          cancelUrl: `${window.location.origin}/checkout?payment=cancelled`
        })
      })
      const result = await response.json()
      if (!response.ok) return setError(result.error || 'Não foi possível iniciar o pagamento.')
      if (result.pix) {
        savePendingPayment({ externalReference: result.externalReference })
        setPixData({ ...result.pix, externalReference: result.externalReference })
        return
      }
      if (result.url) {
        savePendingPayment(paymentMethod === 'pix' ? { externalReference: result.externalReference } : { sessionId: result.sessionId })
        window.location.href = result.url
        return
      }
      return setError('Sessão de pagamento iniciada, mas sem redirecionamento disponível.')
    } catch {
      setError('Não foi possível registrar o pedido no momento.')
    }
  }
  if (confirming) return <section className="container checkout-page success-page"><p className="eyebrow">PAGAMENTO</p><h1>Confirmando seu pagamento...</h1><p className="cart-muted">Aguarde um instante enquanto validamos o pagamento.</p></section>
  if (confirmedOrderId) return <section className="container checkout-page success-page pix-screen"><div className="pix-status-icon pix-status-success">✓</div><p className="eyebrow" style={{ textAlign: 'center' }}>PEDIDO CONFIRMADO</p><h1 style={{ textAlign: 'center' }}>Pagamento aprovado, obrigado pela sua compra!</h1><p style={{ textAlign: 'center' }}>Pedido <strong>#{confirmedOrderId}</strong> registrado com sucesso. Você pode acompanhar o status na sua conta.</p><Link href="/products" className="primary-button">Continuar comprando <span>→</span></Link></section>
  if (pixData) {
    const minutes = String(Math.floor(pixSecondsLeft / 60)).padStart(2, '0')
    const seconds = String(pixSecondsLeft % 60).padStart(2, '0')
    return <section className="container checkout-page success-page pix-screen">
      <div className="pix-status-icon pix-status-pending">⏱</div>
      <h1 style={{ textAlign: 'center' }}>Pix gerado com sucesso!</h1>
      <p className="cart-muted" style={{ textAlign: 'center' }}>Escaneie o QR Code no app do seu banco ou use o Pix Copia e Cola para concluir o pagamento.</p>
      <div className="pix-card">
        {pixData.qrCodeBase64 && <img className="pix-qr-image" src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code Pix" />}
        {pixData.expiresAt && <p className="pix-expiry">Expira em {minutes}:{seconds}</p>}
        <div className="pix-copy-box"><input readOnly value={pixData.qrCode} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={copyPixCode}>{pixCopied ? 'Copiado!' : 'Copiar'}</button></div>
      </div>
      <p className="cart-muted" style={{ textAlign: 'center' }}>Assim que o pagamento for aprovado pelo seu banco, a confirmação aparece aqui automaticamente.</p>
      <div style={{ textAlign: 'center' }}>
        <button className="outline-button" type="button" onClick={() => { clearPendingPayment(); setPixData(null) }}>Cancelar e escolher outra forma de pagamento</button>
      </div>
    </section>
  }
  if (awaitingPayment) return <section className="container checkout-page success-page"><p className="eyebrow">PAGAMENTO</p><h1>Aguardando confirmação do pagamento</h1><p className="cart-muted">{error || 'Assim que o pagamento for aprovado pelo banco, seu pedido será confirmado automaticamente.'}</p><button className="primary-button" type="button" onClick={() => checkPendingPayment()}>Verificar pagamento <span>→</span></button>{' '}<button className="outline-button" type="button" onClick={() => { clearPendingPayment(); setAwaitingPayment(false); setError('') }}>Ainda não paguei, cancelar e tentar novamente</button></section>
  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1><p className="cart-muted">Você precisa estar cadastrado para finalizar o pedido.</p><Link href="/account" className="primary-button">Criar ou acessar conta <span>→</span></Link></section>
  if (!items.length) return <section className="container checkout-page"><h1>Seu carrinho está vazio</h1><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  const effectiveShipping = coupon?.freeShipping ? 0 : shipping
  const discount = coupon ? (coupon.freeShipping ? 0 : subtotal * coupon.discountPercent / 100) : 0
  const maxPoints = maxRedeemablePoints(availablePoints, subtotal)
  const pointsDiscount = pointsToDiscount(pointsToRedeem)
  return <section className="container checkout-page"><p className="eyebrow">FINALIZAÇÃO</p><h1>Checkout</h1><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><fieldset><legend>Dados para entrega</legend><div className="form-grid"><label>Nome completo<input required defaultValue={customer.name} /></label><label>CPF ou CNPJ<input required defaultValue={customer.document} /></label><label>E-mail<input required type="email" defaultValue={customer.email} /></label><label>Telefone<input required defaultValue={customer.phone} /></label><label>CEP<input required defaultValue={customer.cep} /></label><label>Endereço<input required defaultValue={customer.address} /></label><label>Número<input required defaultValue={customer.number} /></label><label>Cidade / UF<input required defaultValue={customer.city} /></label></div></fieldset><fieldset><legend>Escolha método de pagamento</legend><div className="coupon-box"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Cupom de desconto" /><button type="button" onClick={() => void applyCoupon()}>Aplicar cupom</button>{coupon && <small>{coupon.freeShipping ? 'Frete grátis aplicado' : `${coupon.discountPercent}% de desconto aplicado`}</small>}</div>{maxPoints >= 100 && <div className="points-box"><label>Usar meus pontos ({availablePoints} pts disponíveis)<input type="range" min={0} max={maxPoints} step={50} value={pointsToRedeem} onChange={(event) => setPointsToRedeem(Number(event.target.value))} /></label><small>{pointsToRedeem} pts = {money(pointsDiscount)} de desconto</small></div>}<div className="payment-method-card"><label className="payment-option"><input type="radio" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} /> <strong>Pix</strong> — via Mercado Pago, aprovação na hora</label><label className="payment-option"><input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} /> <strong>Cartão de crédito</strong> — via Stripe</label><label className="payment-option"><input type="radio" checked={paymentMethod === 'boleto'} onChange={() => setPaymentMethod('boleto')} /> <strong>Boleto bancário</strong> — via Stripe</label></div></fieldset>{error && <p className="form-status">{error}</p>}<button className="primary-button" type="submit">Ir para método de pagamento <span>→</span></button></form><aside className="cart-summary"><h2>Resumo</h2>{items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div><span>{carrier} ({shippingDeadline})</span><strong>{money(effectiveShipping)}</strong></div>{coupon && (coupon.freeShipping ? <div><span>Frete grátis ({coupon.code})</span><strong>- {money(shipping)}</strong></div> : <div><span>Desconto ({coupon.discountPercent}%)</span><strong>- {money(discount)}</strong></div>)}{pointsToRedeem > 0 && <div><span>Pontos ({pointsToRedeem} pts)</span><strong>- {money(pointsDiscount)}</strong></div>}<div className="summary-total"><span>Total</span><strong>{money(Math.max(0, subtotal + effectiveShipping - discount - pointsDiscount))}</strong></div><p className="points-earn-preview">Você ganha {purchasePointsPreview(subtotal - discount)} pontos nesta compra</p></aside></div></section>
}
