import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '../components/CartContext'
import { useCustomer } from '../components/CustomerContext'

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem } = useCart()
  const { customer } = useCustomer()
  const [cep, setCep] = useState('')
  const [shipping, setShipping] = useState<{ price: number; deadline: string } | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (customer?.cep && !cep) setCep(customer.cep)
  }, [customer?.cep, cep])

  async function calculateShipping() { const cleanCep = cep.replace(/\D/g, ''); if (cleanCep.length !== 8) return setMessage('Informe um CEP válido.'); setMessage('Calculando frete...'); const response = await fetch(`/api/shipping?cep=${cleanCep}`); const result = await response.json(); if (!response.ok) return setMessage(result.error); setShipping(result); setMessage('Frete calculado.') }
  if (!items.length) return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Carrinho vazio</h1><p className="cart-muted">Adicione uma peça ao carrinho para continuar.</p><Link href="/products" className="primary-button">Ver catálogo <span>→</span></Link></section>
  return <section className="container cart-page"><p className="eyebrow">SUA COMPRA</p><h1>Seu carrinho</h1><div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}><img src={item.image} alt={item.name} /><div><small>{item.brand || 'Alpha Tec'}</small><h2>{item.name}</h2><p>{money(item.price)} por unidade</p></div><input aria-label={`Quantidade de ${item.name}`} type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} /><strong>{money(item.price * item.quantity)}</strong><button type="button" onClick={() => removeItem(item.id)}>Remover</button></article>)}</div><aside className="cart-summary"><h2>Resumo do pedido</h2><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><label>Calcule o frete<input value={cep} onChange={(event) => setCep(event.target.value)} placeholder="00000-000" /><button type="button" onClick={calculateShipping}>Calcular frete</button></label>{message && <p className="form-status">{message}</p>}{shipping && <div><span>Frete ({shipping.deadline})</span><strong>{money(shipping.price)}</strong></div>}<div className="summary-total"><span>Total</span><strong>{money(subtotal + (shipping?.price || 0))}</strong></div><Link href={shipping ? `/checkout?cep=${cep}&shipping=${shipping.price}` : '#'} className={shipping ? 'primary-button' : 'primary-button disabled-link'}>Ir para pagamento <span>→</span></Link></aside></div></section>
}
