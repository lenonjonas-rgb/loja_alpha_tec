import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'
import { readPendingPayment, clearPendingPayment, confirmPendingPayment } from '../lib/pending-payment'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
type ShippingOption = { carrier: string; price: number; deadline: string }

// mantém um valor de texto local enquanto o cliente digita, para permitir apagar o campo sem remover o item;
// só aplica (ou remove, se ficar em 0) quando o campo perde o foco
function QuantityInput({ name, quantity, onCommit }: { name: string; quantity: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(quantity))
  useEffect(() => { setText(String(quantity)) }, [quantity])
  function commit() {
    const parsed = Math.max(0, Math.floor(Number(text) || 0))
    if (parsed !== quantity) onCommit(parsed)
    else setText(String(quantity))
  }
  return <input
    aria-label={`Quantidade de ${name}`}
    type="number"
    min="1"
    value={text}
    onChange={(event) => setText(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
  />
}

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart()
  const { customer } = useCustomer()
  const [cep, setCep] = useState('')
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shipping, setShipping] = useState<ShippingOption | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number; freeShipping: boolean } | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const pending = readPendingPayment()
    if (!pending) return
    confirmPendingPayment(pending)
      .then((result) => {
        if (result.confirmed) {
          clearCart()
          clearPendingPayment()
          setMessage('Pagamento confirmado! Seu pedido foi registrado com sucesso.')
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!customer?.cep || cep) return
    setCep(customer.cep)
    void calculateShipping(customer.cep)
  }, [customer?.cep, cep])

  async function calculateShipping(cepToCalculate = cep) { const cleanCep = cepToCalculate.replace(/\D/g, ''); if (cleanCep.length !== 8) return setMessage('Informe um CEP válido.'); setMessage('Calculando frete...'); const response = await fetch(`/api/shipping?cep=${cleanCep}`); const result = await response.json(); if (!response.ok || !result.options?.length) return setMessage(result.error || 'Não foi possível encontrar opções de frete.'); setShippingOptions(result.options); setShipping(result.options[0]); setMessage('Escolha a modalidade de frete.') }

  async function applyCoupon() {
    const trimmedCode = couponCode.trim()
    if (!trimmedCode) return setCouponMessage('Informe o código do cupom.')

    try {
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, items })
      })

      const result = await response.json()
      if (!response.ok) {
        setCoupon(null)
        return setCouponMessage(result.error || 'Cupom inválido.')
      }

      setCoupon({ code: result.code, discountPercent: Number(result.discountPercent) || 0, freeShipping: Boolean(result.freeShipping) })
      setCouponMessage(result.freeShipping ? `Cupom ${result.code} aplicado: frete grátis.` : `Cupom ${result.code} aplicado com ${Number(result.discountPercent) || 0}% de desconto.`)
    } catch {
      setCoupon(null)
      setCouponMessage('Não foi possível validar o cupom agora.')
    }
  }

  const effectiveShipping = coupon?.freeShipping ? 0 : shipping?.price || 0
  const discountAmount = coupon ? (coupon.freeShipping ? 0 : subtotal * coupon.discountPercent / 100) : 0
  const total = Math.max(0, subtotal + effectiveShipping - discountAmount)
  const checkoutHref = shipping
    ? `/checkout?cep=${cep}&shipping=${coupon?.freeShipping ? 0 : shipping.price}&carrier=${encodeURIComponent(shipping.carrier)}&deadline=${encodeURIComponent(shipping.deadline)}${coupon ? `&coupon=${encodeURIComponent(coupon.code)}` : ''}`
    : '#'

  if (!items.length) return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Carrinho vazio</h1><p className="cart-muted">Adicione uma peça ao carrinho para continuar.</p><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Seu carrinho</h1><div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}><img src={item.image} alt={item.name} /><div><small>{item.brand || 'Alpha Tec'}</small><h2>{item.name}</h2><p>{money(item.price)} por unidade</p></div><QuantityInput name={item.name} quantity={item.quantity} onCommit={(value) => updateQuantity(item.id, value)} /><strong>{money(item.price * item.quantity)}</strong><button type="button" onClick={() => removeItem(item.id)}>Remover</button></article>)}</div><aside className="cart-summary"><h2>Resumo do pedido</h2><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><label>Calcule o frete<input value={cep} onChange={(event) => setCep(event.target.value)} placeholder="00000-000" /><button type="button" onClick={() => void calculateShipping()}>Calcular frete</button></label>{message && <p className="form-status">{message}</p>}{shippingOptions.map((option) => <label key={option.carrier} className="payment-option"><input type="radio" name="shipping" checked={shipping?.carrier === option.carrier} onChange={() => setShipping(option)} /> {option.carrier} - {option.deadline} <strong>{money(option.price)}</strong></label>)}<div className="coupon-box"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Digite seu cupom" /><button type="button" onClick={() => void applyCoupon()}>Aplicar</button></div>{couponMessage && <p className="form-status">{couponMessage}</p>}{coupon && (coupon.freeShipping ? <div><span>Frete grátis ({coupon.code})</span><strong>- {money(shipping?.price || 0)}</strong></div> : <div><span>Desconto ({coupon.code})</span><strong>- {money(discountAmount)}</strong></div>)}<div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><Link href={shipping ? checkoutHref : '#'} className={shipping ? 'primary-button' : 'primary-button disabled-link'}>Ir para pagamento <span>→</span></Link></aside></div></section>
}
