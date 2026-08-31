import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
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
  const [couponCode, setCouponCode] = useState(String(router.query.coupon || ''))
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number; freeShipping: boolean } | null>(null)
  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=checkout') }, [customer, router])
  useEffect(() => {
    const couponFromQuery = typeof router.query.coupon === 'string' ? router.query.coupon : ''
    if (!couponFromQuery) return
    setCouponCode(couponFromQuery)
    void applyCoupon(couponFromQuery)
  }, [router.query.coupon])
  useEffect(() => {
    if (!router.isReady) return
    const paymentStatus = String(router.query.payment || '')
    if (paymentStatus === 'success') {
      const sessionId = String(router.query.session_id || '')
      if (!sessionId) return
      setConfirming(true)
      fetch('/api/stripe-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
        .then((response) => response.json())
        .then((result) => {
          if (result.confirmed) {
            setConfirmedOrderId(result.orderId)
            clearCart()
          } else {
            setError('Pagamento recebido, mas ainda em processamento. Assim que for aprovado, o pedido aparecerá automaticamente.')
          }
        })
        .catch(() => setError('Não foi possível confirmar automaticamente o pagamento. Se o pedido não aparecer em instantes, entre em contato.'))
        .finally(() => setConfirming(false))
    } else if (paymentStatus === 'cancelled') {
      setError('Pagamento cancelado ou não concluído. Você pode tentar novamente.')
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
          paymentMethod: 'stripe',
          successUrl: `${window.location.origin}/checkout?payment=success`,
          cancelUrl: `${window.location.origin}/checkout?payment=cancelled`
        })
      })
      const result = await response.json()
      if (!response.ok) return setError(result.error || 'Não foi possível iniciar o pagamento.')
      if (result.url) {
        window.location.href = result.url
        return
      }
      return setError('Sessão de pagamento iniciada, mas sem redirecionamento disponível.')
    } catch {
      setError('Não foi possível registrar o pedido no momento.')
    }
  }
  if (confirming) return <section className="container checkout-page success-page"><p className="eyebrow">PAGAMENTO</p><h1>Confirmando seu pagamento...</h1><p className="cart-muted">Aguarde um instante enquanto validamos o pagamento com o Mercado Pago.</p></section>
  if (confirmedOrderId) return <section className="container checkout-page success-page"><p className="eyebrow">PEDIDO CONFIRMADO</p><h1>Pagamento aprovado, obrigado pela sua compra!</h1><p>Pedido <strong>#{confirmedOrderId}</strong> registrado com sucesso. Você pode acompanhar o status na sua conta.</p><Link href="/products" className="primary-button">Continuar comprando <span>→</span></Link></section>
  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1><p className="cart-muted">Você precisa estar cadastrado para finalizar o pedido.</p><Link href="/account" className="primary-button">Criar ou acessar conta <span>→</span></Link></section>
  if (!items.length) return <section className="container checkout-page"><h1>Seu carrinho está vazio</h1><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  const effectiveShipping = coupon?.freeShipping ? 0 : shipping
  const discount = coupon ? (coupon.freeShipping ? 0 : subtotal * coupon.discountPercent / 100) : 0
  return <section className="container checkout-page"><p className="eyebrow">FINALIZAÇÃO</p><h1>Checkout</h1><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><fieldset><legend>Dados para entrega</legend><div className="form-grid"><label>Nome completo<input required defaultValue={customer.name} /></label><label>CPF ou CNPJ<input required defaultValue={customer.document} /></label><label>E-mail<input required type="email" defaultValue={customer.email} /></label><label>Telefone<input required defaultValue={customer.phone} /></label><label>CEP<input required defaultValue={customer.cep} /></label><label>Endereço<input required defaultValue={customer.address} /></label><label>Número<input required defaultValue={customer.number} /></label><label>Cidade / UF<input required defaultValue={customer.city} /></label></div></fieldset><fieldset><legend>Escolha método de pagamento</legend><div className="coupon-box"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Cupom de desconto" /><button type="button" onClick={() => void applyCoupon()}>Aplicar cupom</button>{coupon && <small>{coupon.freeShipping ? 'Frete grátis aplicado' : `${coupon.discountPercent}% de desconto aplicado`}</small>}</div><div className="payment-method-card"><strong>Stripe</strong><p>Pague com cartão de crédito de forma segura. Você será redirecionado para o ambiente do Stripe para concluir o pagamento.</p></div></fieldset>{error && <p className="form-status">{error}</p>}<button className="primary-button" type="submit">Ir para método de pagamento <span>→</span></button></form><aside className="cart-summary"><h2>Resumo</h2>{items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div><span>{carrier} ({shippingDeadline})</span><strong>{money(effectiveShipping)}</strong></div>{coupon && (coupon.freeShipping ? <div><span>Frete grátis ({coupon.code})</span><strong>- {money(shipping)}</strong></div> : <div><span>Desconto ({coupon.discountPercent}%)</span><strong>- {money(discount)}</strong></div>)}<div className="summary-total"><span>Total</span><strong>{money(subtotal + effectiveShipping - discount)}</strong></div></aside></div></section>
}
