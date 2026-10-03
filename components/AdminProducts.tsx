import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { CORREIOS_PACKAGE_DEFAULTS } from '../lib/shipping-limits'
import { getProductCategories } from '../lib/products'

type Product = {
  id: string
  displayOrder?: number
  name: string
  internalCode?: string
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
  showInFeatured: boolean
  weightKg?: number
  heightCm?: number
  widthCm?: number
  lengthCm?: number
}

type Props = { products: Product[]; onSaved: (product: Product) => void; onReordered: (products: Product[]) => void; onMessage: (message: string) => void }

const categories = ['Esteiras', 'Musculação', 'Bicicletas', 'Elípticos', 'Acessórios', 'Peças diversas']

function toggleCategory(value: string, category: string) {
  const selectedCategories = getProductCategories(value)
  if (selectedCategories.includes(category)) {
    return selectedCategories.length > 1 ? selectedCategories.filter((item) => item !== category).join(', ') : value
  }
  return [...selectedCategories, category].join(', ')
}

export default function AdminProducts({ products, onSaved, onReordered, onMessage }: Props) {
  const [selected, setSelected] = useState<Product | null>(null)
  const [orderedProducts, setOrderedProducts] = useState<Product[]>(products)
  const [drafts, setDrafts] = useState<Record<string, Product>>(() => Object.fromEntries(products.map((product) => [product.id, product])))
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [imageEditorSource, setImageEditorSource] = useState('')
  const [imageEditorOpen, setImageEditorOpen] = useState(false)
  const [imageEditorZoom, setImageEditorZoom] = useState(1)
  const [imageEditorReady, setImageEditorReady] = useState(false)
  const imageEditorCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setOrderedProducts(products)
    setDrafts(Object.fromEntries(products.map((product) => [product.id, product])))
  }, [products])

  useEffect(() => {
    const canvas = imageEditorCanvasRef.current
    if (!imageEditorOpen || !imageEditorSource || !canvas) return
    canvas.width = 1200
    canvas.height = 1200
    setImageEditorReady(false)
    const context = canvas.getContext('2d')
    if (!context) return
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      context.fillStyle = '#e8eaec'
      context.fillRect(0, 0, 1200, 1200)
      context.fillStyle = '#d9dcdf'
      context.fillRect(0, 0, 1200, 14)
      context.fillStyle = '#34383c'
      context.fillRect(0, 1182, 1200, 18)
      context.fillStyle = '#8d2529'
      context.fillRect(1170, 14, 8, 118)
      context.strokeStyle = 'rgba(52,56,60,.16)'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(70, 80)
      context.lineTo(250, 80)
      context.moveTo(950, 1120)
      context.lineTo(1130, 1120)
      context.stroke()

      const scale = Math.min(900 / image.naturalWidth, 900 / image.naturalHeight) * imageEditorZoom
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      const shadow = context.createRadialGradient(600, 990, 15, 600, 990, 320)
      shadow.addColorStop(0, 'rgba(32,36,40,.2)')
      shadow.addColorStop(1, 'rgba(32,36,40,0)')
      context.fillStyle = shadow
      context.beginPath()
      context.ellipse(600, 990, Math.min(drawWidth * .34, 330), 28, 0, 0, Math.PI * 2)
      context.fill()

      context.save()
      context.beginPath()
      context.rect(90, 90, 1020, 1020)
      context.clip()
      context.drawImage(image, (1200 - drawWidth) / 2, (1200 - drawHeight) / 2, drawWidth, drawHeight)
      context.restore()
      setImageEditorReady(true)
    }
    image.onerror = () => {
      if (!cancelled) setImageEditorReady(false)
    }
    image.src = imageEditorSource
    return () => { cancelled = true }
  }, [imageEditorOpen, imageEditorSource, imageEditorZoom])

  async function reorderProducts(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    const fromIndex = orderedProducts.findIndex((product) => product.id === draggedId)
    const toIndex = orderedProducts.findIndex((product) => product.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const previous = orderedProducts
    const next = [...orderedProducts]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setOrderedProducts(next)
    setDraggedId(null)
    const response = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds: next.map((product) => product.id) }) })
    if (!response.ok) {
      setOrderedProducts(previous)
      const result = await response.json().catch(() => ({}))
      return onMessage(result.error || 'Não foi possível salvar a ordem dos produtos.')
    }
    onReordered(next)
    onMessage('Ordem dos produtos atualizada.')
  }

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
    setImageEditorOpen(false)
    setImageEditorSource('')
    onMessage('Produto atualizado.')
  }

  function image(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    if (!file.type.startsWith('image/')) return onMessage('Selecione um arquivo de imagem válido.')

    const reader = new FileReader()
    reader.onload = () => {
      const source = String(reader.result || '')
      if (!source) return onMessage('Não foi possível carregar a imagem selecionada.')
      setImageEditorSource(source)
      setImageEditorZoom(1)
      setImageEditorOpen(true)
    }
    reader.onerror = () => onMessage('Não foi possível ler o arquivo de imagem.')
    reader.readAsDataURL(file)
  }

  function applySiteImage() {
    const canvas = imageEditorCanvasRef.current
    if (!canvas || !imageEditorReady || !selected) return onMessage('Aguarde a prévia da imagem terminar de carregar.')
    try {
      setSelected({ ...selected, image: canvas.toDataURL('image/jpeg', 0.95) })
      setImageEditorOpen(false)
      setImageEditorSource('')
      onMessage('Imagem preparada no padrão quadrado para o site. Salve o produto para confirmar.')
    } catch {
      onMessage('Não foi possível preparar a imagem. Tente usar um arquivo local em JPG ou PNG.')
    }
  }

  if (selected) {
    return (
      <form className="admin-form" onSubmit={save}>
        <div className="admin-heading">
          <h2>Editar produto</h2>
          <button className="outline-button" type="button" onClick={() => { setSelected(null); setImageEditorOpen(false); setImageEditorSource('') }}>Voltar à lista</button>
        </div>

        <div className="form-grid">
          <label>Nome<input required value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></label>
          <label>Código interno<input value={selected.internalCode || ''} onChange={(event) => setSelected({ ...selected, internalCode: event.target.value })} placeholder="Ex.: AT-EST-001" /></label>
          <label>Marca<input required value={selected.brand} onChange={(event) => setSelected({ ...selected, brand: event.target.value })} /></label>
          <fieldset className="category-checkbox-field">
            <legend>Categorias</legend>
            <div className="category-checkboxes">
              {categories.map((category) => <label key={category}><input type="checkbox" checked={getProductCategories(selected.category).includes(category)} onChange={() => setSelected({ ...selected, category: toggleCategory(selected.category, category) })} /> {category}</label>)}
            </div>
          </fieldset>
          <label>Preço<input required type="number" min="0" step="0.01" value={selected.price} onChange={(event) => setSelected({ ...selected, price: Number(event.target.value) })} /></label>
          <label>Estoque disponível<input required type="number" min="0" value={selected.stock ?? 0} onChange={(event) => setSelected({ ...selected, stock: Number(event.target.value) })} /></label>
          <label>Desconto (%)<input type="number" min="0" max="100" value={selected.discountPercent ?? 0} onChange={(event) => setSelected({ ...selected, discountPercent: Number(event.target.value) })} /></label>
          <label>Peso (kg)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.weightKg} step="0.001" value={selected.weightKg ?? ''} onChange={(event) => setSelected({ ...selected, weightKg: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Altura (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.heightCm} step="0.1" value={selected.heightCm ?? ''} onChange={(event) => setSelected({ ...selected, heightCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Largura (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.widthCm} step="0.1" value={selected.widthCm ?? ''} onChange={(event) => setSelected({ ...selected, widthCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Comprimento (cm)<input required type="number" min={CORREIOS_PACKAGE_DEFAULTS.lengthCm} step="0.1" value={selected.lengthCm ?? ''} onChange={(event) => setSelected({ ...selected, lengthCm: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label>Modelos compatíveis<textarea value={selected.compatibleEquipment || ''} onChange={(event) => setSelected({ ...selected, compatibleEquipment: event.target.value })} placeholder={'Movement RT 150\nMovement RT 250\nMovement RT 350'} /></label>
          <label>Descrição<textarea required value={selected.description} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
          <label>Especificações<textarea required value={selected.specifications || ''} onChange={(event) => setSelected({ ...selected, specifications: event.target.value })} placeholder={'Tensão: 220V\nPotência: 2,2HP'} /></label>
          <label>Imagem<input type="file" accept="image/*" onChange={image} /></label>
          {selected.image && <div className="admin-image-edit-actions"><img className="admin-image-preview" src={selected.image} alt="Pré-visualização do produto" /><button className="outline-button" type="button" onClick={() => { setImageEditorSource(selected.image); setImageEditorZoom(1); setImageEditorOpen(true) }}>Editar para site</button></div>}
          {imageEditorOpen && <div className="admin-site-image-editor">
            <canvas ref={imageEditorCanvasRef} className="admin-site-image-canvas" aria-label="Prévia quadrada da imagem editada para site" />
            <div className="admin-site-image-controls">
              <strong>Prévia para e-commerce · 1200 × 1200</strong>
              <label>Enquadramento<input type="range" min="0.7" max="1.12" step="0.01" value={imageEditorZoom} onChange={(event) => setImageEditorZoom(Number(event.target.value))} /><small>Ampliação {Math.round(imageEditorZoom * 100)}% · mantenha a peça dentro da margem de segurança.</small></label>
              <p className="form-hint">O produto é preservado sem deformação. O fundo da foto original não é removido automaticamente.</p>
              <div className="admin-site-image-actions">
                <button className="primary-button" type="button" disabled={!imageEditorReady} onClick={applySiteImage}>Usar imagem editada</button>
                <button className="outline-button" type="button" onClick={() => { setImageEditorOpen(false); setImageEditorSource('') }}>Cancelar</button>
              </div>
            </div>
          </div>}
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

      {orderedProducts.map((product) => {
        const draft = drafts[product.id] || product
        return (
          <div className={`product-admin-row ${draggedId === product.id ? 'is-dragging' : ''}`} key={product.id} draggable onDragStart={() => setDraggedId(product.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void reorderProducts(product.id)} onDragEnd={() => setDraggedId(null)}>
            <button className="product-drag-handle" type="button" draggable={false} aria-label={`Arrastar ${product.name}`} title="Arrastar para reordenar">::</button>
            <span>
              <strong>{product.name}</strong>
              <small>{product.internalCode ? `Cód. ${product.internalCode} · ` : ''}{product.brand} · {getProductCategories(product.category).join(' / ')}</small>
            </span>
            <label>Estoque<input type="number" min="0" value={draft.stock || 0} onChange={(event) => updateDraft(product, { stock: Number(event.target.value) })} /></label>
            <label>Desconto %<input type="number" min="0" max="100" value={draft.discountPercent ?? 0} onChange={(event) => updateDraft(product, { discountPercent: Number(event.target.value) })} /></label>
            <label className="active-toggle"><input type="checkbox" checked={Boolean(draft.flashSale)} onChange={(event) => updateDraft(product, { flashSale: event.target.checked })} /> Oferta</label>
            <label className="active-toggle"><input type="checkbox" checked={Boolean(draft.showInBanner)} onChange={(event) => updateDraft(product, { showInBanner: event.target.checked })} /> Banner</label>
              <label className="active-toggle"><input type="checkbox" checked={Boolean(draft.showInFeatured)} onChange={(event) => updateDraft(product, { showInFeatured: event.target.checked })} /> Destaque</label>
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
