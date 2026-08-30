import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
export default function Checkout() {
  const router = useRouter()
  const { items, subtotal } = useCart()
  const { customer } = useCustomer()
  const [submitted, setSubmitted] = useState(false)
  const [payment, setPayment] = useState('pix')
  const [shipping] = useState(Number(router.query.shipping || 41.09))
  const [carrier] = useState(String(router.query.carrier || 'Correios'))
  const [shippingDeadline] = useState(String(router.query.deadline || 'A calcular'))
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState(String(router.query.coupon || ''))
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null)
  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=checkout') }, [customer, router])
  useEffect(() => {
    const couponFromQuery = typeof router.query.coupon === 'string' ? router.query.coupon : ''
    if (!couponFromQuery) return
    setCouponCode(couponFromQuery)
    void applyCoupon(couponFromQuery)
  }, [router.query.coupon])
  async function applyCoupon(codeToApply = couponCode) { const response = await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeToApply, items }) }); const result = await response.json(); if (!response.ok) return setError(result.error); setCoupon(result); setError('Cupom aplicado.') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!customer?.id) return setError('Sua conta precisa ser cadastrada novamente para continuar.')
    if (!supabase) return setError('Serviço de autenticação não configurado.')
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session) return setError('Sua sessão expirou. Entre novamente na conta.')

      const total = subtotal + shipping - (coupon ? subtotal * coupon.discountPercent / 100 : 0)

      if (payment === 'stripe') {
        const response = await fetch('/api/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            customerId: customer.id,
            items,
            shipping,
            carrier,
            couponCode: coupon?.code,
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
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          customerId: customer.id,
          items,
          shipping,
          carrier,
          paymentMethod: payment,
          couponCode: coupon?.code
        })
      })
      const result = await response.json()
      if (!response.ok) return setError(result.error || 'Não foi possível registrar o pedido.')
      setSubmitted(true)
    } catch {
      setError('Não foi possível registrar o pedido no momento.')
    }
  }
  if (submitted) return <section className="container checkout-page success-page"><p className="eyebrow">PEDIDO RECEBIDO</p><h1>Obrigado pela sua compra.</h1><p>Pedido registrado. A confirmação real do pagamento será ativada quando o gateway for configurado.</p><Link href="/products" className="primary-button">Continuar comprando <span>→</span></Link></section>
  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1><p className="cart-muted">Você precisa estar cadastrado para finalizar o pedido.</p><Link href="/account" className="primary-button">Criar ou acessar conta <span>→</span></Link></section>
  if (!items.length) return <section className="container checkout-page"><h1>Seu carrinho está vazio</h1><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  const discount = coupon ? subtotal * coupon.discountPercent / 100 : 0
  return <section className="container checkout-page"><p className="eyebrow">FINALIZAÇÃO</p><h1>Checkout</h1><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><fieldset><legend>Dados para entrega</legend><div className="form-grid"><label>Nome completo<input required defaultValue={customer.name} /></label><label>CPF ou CNPJ<input required defaultValue={customer.document} /></label><label>E-mail<input required type="email" defaultValue={customer.email} /></label><label>Telefone<input required defaultValue={customer.phone} /></label><label>CEP<input required defaultValue={customer.cep} /></label><label>Endereço<input required defaultValue={customer.address} /></label><label>Número<input required defaultValue={customer.number} /></label><label>Cidade / UF<input required defaultValue={customer.city} /></label></div></fieldset><fieldset><legend>Forma de pagamento</legend><div className="coupon-box"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Cupom de desconto" /><button type="button" onClick={() => void applyCoupon()}>Aplicar cupom</button>{coupon && <small>{coupon.discountPercent}% de desconto aplicado</small>}</div><label className="payment-option"><input type="radio" checked={payment === 'pix'} onChange={() => setPayment('pix')} /> PIX</label><label className="payment-option"><input type="radio" checked={payment === 'card'} onChange={() => setPayment('card')} /> Cartão de crédito</label><label className="payment-option"><input type="radio" checked={payment === 'stripe'} onChange={() => setPayment('stripe')} /> Stripe (cartão) </label><p className="form-hint">PIX e cartão continuam em modo de teste; Stripe requer a variável STRIPE_SECRET_KEY configurada na Vercel.</p></fieldset>{error && <p className="form-status">{error}</p>}<button className="primary-button" type="submit">Confirmar pedido <span>→</span></button></form><aside className="cart-summary"><h2>Resumo</h2>{items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div><span>{carrier} ({shippingDeadline})</span><strong>{money(shipping)}</strong></div>{coupon && <div><span>Desconto ({coupon.discountPercent}%)</span><strong>- {money(discount)}</strong></div>}<div className="summary-total"><span>Total</span><strong>{money(subtotal + shipping - discount)}</strong></div></aside></div></section>
}
