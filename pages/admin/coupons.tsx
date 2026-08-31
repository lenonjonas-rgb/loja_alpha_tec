import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type Coupon = {
  id: string
  code: string
  discount_percent: number
  active: boolean
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  product_id: string | null
  category: string | null
  free_shipping: boolean
}

type Product = { id: string; name: string; category: string }

type CouponForm = {
  code: string
  discountPercent: string
  expiresAt: string
  usageLimit: string
  freeShipping: boolean
  scope: 'all' | 'product' | 'category'
  productId: string
  category: string
}

const shippingCategory = 'Frete'
const categories = [shippingCategory, 'Esteiras', 'Musculação', 'Bicicletas', 'Acessórios', 'Peças diversas']

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<CouponForm>({
    code: '',
    discountPercent: '10',
    expiresAt: '',
    usageLimit: '',
    freeShipping: false,
    scope: 'all',
    productId: '',
    category: ''
  })

  useEffect(() => {
    fetch('/api/coupons-admin')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setCoupons)
      .catch(() => setMessage('Faça login no admin e execute scripts/commerce.sql no Supabase.'))

    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((items: Product[]) => setProducts(items))
      .catch(() => setProducts([]))
  }, [])

  async function createCoupon(event: FormEvent) {
    event.preventDefault()

    const isFreeShippingCoupon = form.freeShipping

    if (isFreeShippingCoupon) {
      if (form.scope !== 'category') {
        return setMessage('Cupons de frete grátis só podem ser criados por categoria.')
      }

      if (form.category !== shippingCategory) {
        return setMessage('Para cupom de frete grátis, selecione a categoria "Frete".')
      }
    }

    if (form.scope === 'product' && !form.productId) {
      return setMessage('Selecione uma peça para o cupom individual.')
    }

    if (form.scope === 'category' && !form.category) {
      return setMessage('Selecione uma categoria para o cupom por categoria.')
    }

    if (!isFreeShippingCoupon && form.scope === 'category' && form.category === shippingCategory) {
      return setMessage('A categoria "Frete" é exclusiva para cupons de frete grátis.')
    }

    const payload = {
      code: form.code,
      discountPercent: isFreeShippingCoupon ? '0' : form.discountPercent,
      expiresAt: form.expiresAt,
      usageLimit: form.usageLimit,
      freeShipping: isFreeShippingCoupon,
      productId: form.scope === 'product' ? form.productId : undefined,
      category: form.scope === 'category' ? form.category : undefined
    }

    const response = await fetch('/api/coupons-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await response.json()
    if (!response.ok) return setMessage(result.error || 'Não foi possível criar o cupom.')

    setCoupons((items) => [result, ...items])
    setForm({
      code: '',
      discountPercent: '10',
      expiresAt: '',
      usageLimit: '',
      freeShipping: false,
      scope: 'all',
      productId: '',
      category: ''
    })
    setMessage('Cupom criado.')
  }

  async function toggle(coupon: Coupon) {
    const response = await fetch('/api/coupons-admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: coupon.id, active: !coupon.active })
    })

    if (!response.ok) return setMessage('Não foi possível atualizar o cupom.')

    const result = await response.json()
    setCoupons((items) => items.map((item) => item.id === result.id ? result : item))
  }

  async function removeCoupon(coupon: Coupon) {
    if (!window.confirm(`Excluir o cupom ${coupon.code}? Esta ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/coupons-admin?id=${encodeURIComponent(coupon.id)}`, { method: 'DELETE' })
    if (!response.ok) return setMessage('Não foi possível excluir o cupom.')
    setCoupons((items) => items.filter((item) => item.id !== coupon.id))
    setMessage('Cupom excluído.')
  }

  return <section className="admin-page container"><Link href="/admin" className="back-link">← Voltar ao painel</Link><div className="admin-heading"><div><p className="eyebrow">ÁREA MASTER</p><h1>Cupons de desconto</h1></div></div><form className="admin-form" onSubmit={createCoupon}><div className="form-grid"><label>Código<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="BEMVINDO10" /></label><label>Desconto (%)<input required type="number" min="1" max="100" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} /></label><label>Validade<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label><label>Limite de usos<input type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} placeholder="Sem limite" /></label></div><div className="form-grid"><label>Critério<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as CouponForm['scope'], productId: event.target.value === 'product' ? form.productId : '', category: event.target.value === 'category' ? form.category : '' })}><option value="all">Geral</option><option value="product">Peça específica</option><option value="category">Categoria</option></select></label>{form.scope === 'product' && <label>Peça<select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Selecione a peça</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}{form.scope === 'category' && <label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Selecione a categoria</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>}</div><label className="checkbox-row"><input type="checkbox" checked={form.freeShipping} onChange={(event) => setForm({ ...form, freeShipping: event.target.checked, scope: event.target.checked ? 'category' : form.scope, category: event.target.checked ? shippingCategory : form.category === shippingCategory ? '' : form.category, discountPercent: event.target.checked ? '0' : form.discountPercent || '10' })} /> Aplicar como frete grátis</label><button className="primary-button" type="submit">Criar cupom <span>+</span></button>{message && <p className="form-status success">{message}</p>}</form><div className="admin-list"><h2>Cupons cadastrados</h2>{coupons.map((coupon) => <div className="admin-item" key={coupon.id}><span><strong>{coupon.code} · {coupon.free_shipping ? 'Frete grátis' : `${coupon.discount_percent}%`}</strong><small>{coupon.active ? 'Ativo' : 'Inativo'} · {coupon.product_id ? 'Peça específica' : coupon.category ? `Categoria: ${coupon.category}` : 'Geral'} · Usos: {coupon.used_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ''}</small></span><div><button type="button" onClick={() => toggle(coupon)}>{coupon.active ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => void removeCoupon(coupon)}>Excluir</button></div></div>)}</div></section>
}
