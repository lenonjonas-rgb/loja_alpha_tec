import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
type ShippingOption = { carrier: string; price: number; deadline: string }
export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem } = useCart()
  const { customer } = useCustomer()
  const [cep, setCep] = useState('')
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shipping, setShipping] = useState<ShippingOption | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!customer?.cep || cep) return
    setCep(customer.cep)
    void calculateShipping(customer.cep)
  }, [customer?.cep, cep])

  async function calculateShipping(cepToCalculate = cep) { const cleanCep = cepToCalculate.replace(/\D/g, ''); if (cleanCep.length !== 8) return setMessage('Informe um CEP válido.'); setMessage('Calculando frete...'); const response = await fetch(`/api/shipping?cep=${cleanCep}`); const result = await response.json(); if (!response.ok || !result.options?.length) return setMessage(result.error || 'Não foi possível encontrar opções de frete.'); setShippingOptions(result.options); setShipping(result.options[0]); setMessage('Escolha a modalidade de frete.') }
  if (!items.length) return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Carrinho vazio</h1><p className="cart-muted">Adicione uma peça ao carrinho para continuar.</p><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Seu carrinho</h1><div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}><img src={item.image} alt={item.name} /><div><small>{item.brand || 'Alpha Tec'}</small><h2>{item.name}</h2><p>{money(item.price)} por unidade</p></div><input aria-label={`Quantidade de ${item.name}`} type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} /><strong>{money(item.price * item.quantity)}</strong><button type="button" onClick={() => removeItem(item.id)}>Remover</button></article>)}</div><aside className="cart-summary"><h2>Resumo do pedido</h2><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><label>Calcule o frete<input value={cep} onChange={(event) => setCep(event.target.value)} placeholder="00000-000" /><button type="button" onClick={() => void calculateShipping()}>Calcular frete</button></label>{message && <p className="form-status">{message}</p>}{shippingOptions.map((option) => <label key={option.carrier} className="payment-option"><input type="radio" name="shipping" checked={shipping?.carrier === option.carrier} onChange={() => setShipping(option)} /> {option.carrier} - {option.deadline} <strong>{money(option.price)}</strong></label>)}<div className="summary-total"><span>Total</span><strong>{money(subtotal + (shipping?.price || 0))}</strong></div><Link href={shipping ? `/checkout?cep=${cep}&shipping=${shipping.price}&carrier=${encodeURIComponent(shipping.carrier)}&deadline=${encodeURIComponent(shipping.deadline)}` : '#'} className={shipping ? 'primary-button' : 'primary-button disabled-link'}>Ir para pagamento <span>→</span></Link></aside></div></section>
}
