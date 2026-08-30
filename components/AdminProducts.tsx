import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

type Product = { id: string; name: string; brand: string; category: string; compatibleEquipment: string; description: string; image: string; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean }
type CouponDraft = { code: string; discountPercent: string }
type ProductCoupon = { product_id?: string | null; code?: string; discount_percent?: number }
type Props = { products: Product[]; onSaved: (product: Product) => void; onMessage: (message: string) => void }
const categories = ['Esteiras', 'Musculação', 'Bicicletas', 'Acessórios', 'Peças diversas']

export default function AdminProducts({ products, onSaved, onMessage }: Props) {
  const [selected, setSelected] = useState<Product | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Product>>(() => Object.fromEntries(products.map((product) => [product.id, product])))
  const [couponDrafts, setCouponDrafts] = useState<Record<string, CouponDraft>>({})
  const [initialCouponDrafts, setInitialCouponDrafts] = useState<Record<string, CouponDraft>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(products.map((product) => [product.id, product])))
  }, [products])

  useEffect(() => {
    let cancelled = false

    async function loadCouponDrafts() {
      try {
        const response = await fetch('/api/coupons-admin')
        if (!response.ok) return

        const coupons = (await response.json()) as ProductCoupon[]
        if (cancelled) return

        const nextDrafts = Object.fromEntries(
          products.map((product) => {
            const coupon = coupons.find((item) => item.product_id === product.id)
            const draft = {
              code: coupon?.code || '',
              discountPercent: coupon && coupon.discount_percent !== undefined ? String(coupon.discount_percent) : '0'
            }
            return [product.id, draft]
          })
        )

        setCouponDrafts(nextDrafts)
        setInitialCouponDrafts(nextDrafts)
      } catch {
        const fallback = Object.fromEntries(
          products.map((product) => [product.id, { code: '', discountPercent: '0' }])
        )

        if (!cancelled) {
          setCouponDrafts(fallback)
          setInitialCouponDrafts(fallback)
        }
      }
    }

    if (products.length > 0) {
      void loadCouponDrafts()
    }

    return () => {
      cancelled = true
    }
  }, [products])

  function updateDraft(product: Product, patch: Partial<Product>) {
    setDrafts((items) => {
      const current = items[product.id] || product
      return { ...items, [product.id]: { ...current, ...patch } }
    })
  }

  function updateCouponDraft(product: Product, patch: Partial<CouponDraft>) {
    setCouponDrafts((items) => {
      const current = items[product.id] || { code: '', discountPercent: '0' }
      return { ...items, [product.id]: { ...current, ...patch } }
    })
  }

  async function saveAllChanges() {
    const tasks: Promise<void>[] = []

    for (const product of products) {
      const draft = drafts[product.id] || product
      if (JSON.stringify(draft) !== JSON.stringify(product)) {
        tasks.push(
          fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          }).then(async (response) => {
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o produto.')
            onSaved(result)
          })
        )
      }

      const coupon = couponDrafts[product.id] || { code: '', discountPercent: '0' }
      const previousCoupon = initialCouponDrafts[product.id] || { code: '', discountPercent: '0' }
      const normalizedCode = String(coupon.code || '').trim().toUpperCase()
      const discountValue = Number(coupon.discountPercent || 0)
      const previousCode = String(previousCoupon.code || '').trim().toUpperCase()
      const previousDiscount = Number(previousCoupon.discountPercent || 0)
      const couponChanged = normalizedCode !== previousCode || discountValue !== previousDiscount

      if (couponChanged) {
        tasks.push(
          fetch('/api/coupons-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id,
              code: normalizedCode,
              discountPercent: discountValue
            })
          }).then(async (response) => {
            const result = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o cupom da peça.')
            return result
          })
        )
      }
    }

    if (tasks.length === 0) {
      onMessage('Nenhuma alteração para salvar.')
      return
    }

    try {
      await Promise.all(tasks)
      setInitialCouponDrafts(couponDrafts)
      onMessage('Alterações salvas com sucesso.')
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.')
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!selected) return

    const response = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected)
    })

    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível atualizar o produto.')
    onSaved(result)
    setSelected(null)
    onMessage('Produto atualizado.')
  }

  function image(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selected) return

    const reader = new FileReader()
    reader.onload = () => setSelected({ ...selected, image: String(reader.result) })
    reader.readAsDataURL(file)
  }

  if (selected) {
    return <form className="admin-form" onSubmit={save}><div className="admin-heading"><h2>Editar produto</h2><button className="outline-button" type="button" onClick={() => setSelected(null)}>Voltar à lista</button></div><div className="form-grid"><label>Nome<input required value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></label><label>Marca<input required value={selected.brand} onChange={(event) => setSelected({ ...selected, brand: event.target.value })} /></label><label>Categoria<select value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Preço<input required type="number" min="0" step="0.01" value={selected.price} onChange={(event) => setSelected({ ...selected, price: Number(event.target.value) })} /></label><label>Estoque disponível<input required type="number" min="0" value={selected.stock || 0} onChange={(event) => setSelected({ ...selected, stock: Number(event.target.value) })} /></label><label>Desconto (%)<input type="number" min="0" max="100" value={selected.discountPercent || 0} onChange={(event) => setSelected({ ...selected, discountPercent: Number(event.target.value) })} /></label><label className="wide">Imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={image} /></label><label className="wide">Descrição<textarea required rows={4} value={selected.description} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label><label>Compatibilidade<input required value={selected.compatibleEquipment} onChange={(event) => setSelected({ ...selected, compatibleEquipment: event.target.value })} /></label><label className="active-field"><input type="checkbox" checked={selected.flashSale} onChange={(event) => setSelected({ ...selected, flashSale: event.target.checked })} /> Oferta relâmpago</label><label className="active-field"><input type="checkbox" checked={selected.showInBanner} onChange={(event) => setSelected({ ...selected, showInBanner: event.target.checked })} /> Mostrar no banner</label><label className="active-field"><input type="checkbox" checked={selected.active} onChange={(event) => setSelected({ ...selected, active: event.target.checked })} /> Produto ativo</label></div><button className="primary-button" type="submit">Salvar produto <span>→</span></button></form>
  }

  return <div className="admin-list"><div className="lead-toolbar"><div><h2>Produtos cadastrados</h2></div><button className="primary-button" type="button" onClick={saveAllChanges}>Salvar alterações</button></div>{products.map((product) => { const draft = drafts[product.id] || product; const coupon = couponDrafts[product.id] || { code: '', discountPercent: '0' }; return <div className="product-admin-row" key={product.id}><span><strong>{product.name}</strong><small>{product.brand} · {product.category}</small></span><label>Estoque<input type="number" min="0" value={draft.stock || 0} onChange={(event) => updateDraft(product, { stock: Number(event.target.value) })} /></label><label>Desconto %<input type="number" min="0" max="100" value={draft.discountPercent || 0} onChange={(event) => updateDraft(product, { discountPercent: Number(event.target.value) })} /></label><label>Cupom<input value={coupon.code} onChange={(event) => updateCouponDraft(product, { code: event.target.value.toUpperCase() })} placeholder="EXEMPLO10" /></label><label>% cupom<input type="number" min="0" max="100" value={coupon.discountPercent} onChange={(event) => updateCouponDraft(product, { discountPercent: event.target.value })} /></label><label className="active-toggle"><input type="checkbox" checked={Boolean(draft.flashSale)} onChange={(event) => updateDraft(product, { flashSale: event.target.checked })} /> Oferta</label><label className="active-toggle"><input type="checkbox" checked={Boolean(draft.showInBanner)} onChange={(event) => updateDraft(product, { showInBanner: event.target.checked })} /> Banner</label><button type="button" onClick={() => setSelected(draft)}>Editar dados</button></div> })}</div>
}
