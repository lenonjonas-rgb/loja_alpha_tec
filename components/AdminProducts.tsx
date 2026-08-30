import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

type Product = { id: string; name: string; brand: string; category: string; compatibleEquipment: string; description: string; image: string; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean }
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
            body: JSON.stringify(draft)
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

  return <div className="admin-list"><div className="lead-toolbar"><div><h2>Produtos cadastrados</h2></div><button className="primary-button" type="button" onClick={saveAllChanges}>Salvar alterações</button></div>{products.map((product) => { const draft = drafts[product.id] || product; return <div className="product-admin-row" key={product.id}><span><strong>{product.name}</strong><small>{product.brand} · {product.category}</small></span><label>Estoque<input type="number" min="0" value={draft.stock || 0} onChange={(event) => updateDraft(product, { stock: Number(event.target.value) })} /></label><label>Desconto %<input type="number" min="0" max="100" value={draft.discountPercent || 0} onChange={(event) => updateDraft(product, { discountPercent: Number(event.target.value) })} /></label><label className="active-toggle"><input type="checkbox" checked={Boolean(draft.flashSale)} onChange={(event) => updateDraft(product, { flashSale: event.target.checked })} /> Oferta</label><label className="active-toggle"><input type="checkbox" checked={Boolean(draft.showInBanner)} onChange={(event) => updateDraft(product, { showInBanner: event.target.checked })} /> Banner</label><button type="button" onClick={() => setSelected(draft)}>Editar dados</button></div> })}</div>
}
