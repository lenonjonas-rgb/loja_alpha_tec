import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { CORREIOS_PACKAGE_DEFAULTS } from '../lib/shipping-limits'

type Product = {
  id: string
  name: string
  brand: string
  category: string
  compatibleEquipment: string
  description: string
  specifications: string
  image: string
  price: number
  active: boolean
  stock: number
  discountPercent: number
  flashSale: boolean
  showInBanner: boolean
  weightKg?: number
  heightCm?: number
  widthCm?: number
  lengthCm?: number
}

type Props = { products: Product[]; onSaved: (product: Product) => void; onMessage: (message: string) => void }

const categories = ['Esteiras', 'Musculação', 'Bicicletas', 'Acessórios', 'Peças diversas']

export default function AdminProducts({ products, onSaved, onMessage }: Props) {
  const [selected, setSelected] = useState<Product | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Product>>(() => Object.fromEntries(products.map((product) => [product.id, product])))

  useEffect(() => {
    setDrafts(Object.fromEntries(products.map((product) => [product.id, product])))
  }, [products])

  function updateDraft(product: Product, patch: Partial<Product>) {
    setDrafts((items) => {
      const current = items[product.id] || product
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
            body: JSON.stringify({
              ...draft,
              specifications: (draft.specifications || '').trim()
            })
          }).then(async (response) => {
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o produto.')
            onSaved(result)
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
      body: JSON.stringify({
        ...selected,
        specifications: (selected.specifications || '').trim()
      })
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
    return (
      <form className="admin-form" onSubmit={save}>
        <div className="admin-heading">
          <h2>Editar produto</h2>
          <button className="outline-button" type="button" onClick={() => setSelected(null)}>Voltar à lista</button>
        </div>

        <div className="form-grid">
          <label>Nome<input required value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></label>
          <label>Marca<input required value={selected.brand} onChange={(event) => setSelected({ ...selected, brand: event.target.value })} /></label>
          <label>Categoria<select value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Preço<input required type="number" min="0" step="0.01" value={selected.price} onChange={(event) => setSelected({ ...selected, price: Number(event.target.value) })} /></label>
          <label>Estoque disponível<input required type="number" min="0" value={selected.stock ?? 0} onChange={(event) => setSelected({ ...selected, stock: Number(event.target.value) })} /></label>
          <label>Desconto (%)<input type="number" min="0" max="100" value={selected.discountPercent ?? 0} onChange={(event) => setSelected({ ...selected, discountPercent: Number(event.target.value) })} /></label>
          <label>Peso (kg)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.weightKg} step="0.001" value={selected.weightKg ?? ''} onChange={(event) => setSelected({ ...selected, weightKg: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Altura (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.heightCm} step="0.1" value={selected.heightCm ?? ''} onChange={(event) => setSelected({ ...selected, heightCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Largura (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.widthCm} step="0.1" value={selected.widthCm ?? ''} onChange={(event) => setSelected({ ...selected, widthCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Comprimento (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.lengthCm} step="0.1" value={selected.lengthCm ?? ''} onChange={(event) => setSelected({ ...selected, lengthCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Compatível com<input value={selected.compatibleEquipment || ''} onChange={(event) => setSelected({ ...selected, compatibleEquipment: event.target.value })} /></label>
          <label>Descrição<textarea required value={selected.description} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
          <label>Especificações<textarea required value={selected.specifications || ''} onChange={(event) => setSelected({ ...selected, specifications: event.target.value })} placeholder={'Tensão: 220V\nPotência: 2,2HP'} /></label>
          <label>Imagem<input type="file" accept="image/*" onChange={image} /></label>
          {selected.image && <img className="admin-image-preview" src={selected.image} alt="Pré-visualização do produto" />}
        </div>

        <div className="active-field">
          <input type="checkbox" checked={Boolean(selected.active)} onChange={(event) => setSelected({ ...selected, active: event.target.checked })} />
          <label>Produto ativo</label>
        </div>

        <button className="primary-button" type="submit">Salvar alterações <span>→</span></button>
      </form>
    )
  }

  return (
    <div className="admin-list">
      <div className="lead-toolbar">
        <div><h2>Produtos cadastrados</h2></div>
        <button className="primary-button" type="button" onClick={saveAllChanges}>Salvar alterações</button>
      </div>

      {products.map((product) => {
        const draft = drafts[product.id] || product
        return (
          <div className="product-admin-row" key={product.id}>
            <span>
              <strong>{product.name}</strong>
              <small>{product.brand} · {product.category}</small>
            </span>
            <label>Estoque<input type="number" min="0" value={draft.stock || 0} onChange={(event) => updateDraft(product, { stock: Number(event.target.value) })} /></label>
            <label>Desconto %<input type="number" min="0" max="100" value={draft.discountPercent ?? 0} onChange={(event) => updateDraft(product, { discountPercent: Number(event.target.value) })} /></label>
            <label className="active-toggle"><input type="checkbox" checked={Boolean(draft.flashSale)} onChange={(event) => updateDraft(product, { flashSale: event.target.checked })} /> Oferta</label>
            <label className="active-toggle"><input type="checkbox" checked={Boolean(draft.showInBanner)} onChange={(event) => updateDraft(product, { showInBanner: event.target.checked })} /> Banner</label>
            <button
              type="button"
              onClick={() => setSelected({
                ...draft,
                weightKg: draft.weightKg || CORREIOS_PACKAGE_DEFAULTS.weightKg,
                heightCm: draft.heightCm || CORREIOS_PACKAGE_DEFAULTS.heightCm,
                widthCm: draft.widthCm || CORREIOS_PACKAGE_DEFAULTS.widthCm,
                lengthCm: draft.lengthCm || CORREIOS_PACKAGE_DEFAULTS.lengthCm
              })}
            >Editar dados</button>
          </div>
        )
      })}
    </div>
  )
}
