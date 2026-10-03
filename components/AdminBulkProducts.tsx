import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { CORREIOS_PACKAGE_DEFAULTS } from '../lib/shipping-limits'
import { getProductCategories } from '../lib/products'

type ProductRow = {
  name: string
  internalCode: string
  brand: string
  category: string
  compatibleEquipment: string
  price: string
  image: string
  description: string
  specifications: string
  weightKg: string
  heightCm: string
  widthCm: string
  lengthCm: string
}

type Props = { onMessage: (message: string) => void }
type PendingImage = { index: number; source: string }

const categories = ['Esteiras', 'Musculação', 'Bicicletas', 'Elípticos', 'Acessórios', 'Peças diversas']

function toggleCategory(value: string, category: string) {
  const selectedCategories = getProductCategories(value)
  if (selectedCategories.includes(category)) {
    return selectedCategories.length > 1 ? selectedCategories.filter((item) => item !== category).join(', ') : value
  }
  return [...selectedCategories, category].join(', ')
}

const blank = (): ProductRow => ({
  name: '',
  internalCode: '',
  brand: '',
  category: categories[0],
  compatibleEquipment: '',
  price: '',
  image: '',
  description: '',
  specifications: '',
  weightKg: String(CORREIOS_PACKAGE_DEFAULTS.weightKg),
  heightCm: String(CORREIOS_PACKAGE_DEFAULTS.heightCm),
  widthCm: String(CORREIOS_PACKAGE_DEFAULTS.widthCm),
  lengthCm: String(CORREIOS_PACKAGE_DEFAULTS.lengthCm)
})

export default function AdminBulkProducts({ onMessage }: Props) {
  const [rows, setRows] = useState<ProductRow[]>([blank(), blank()])
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imageReady, setImageReady] = useState(false)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = imageCanvasRef.current
    if (!pendingImage || !canvas) return
    canvas.width = 1200
    canvas.height = 1200
    setImageReady(false)
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

      const scale = Math.min(900 / image.naturalWidth, 900 / image.naturalHeight) * imageZoom
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
      setImageReady(true)
    }
    image.onerror = () => {
      if (!cancelled) {
        setImageReady(false)
        onMessage('Não foi possível carregar a imagem para edição.')
      }
    }
    image.src = pendingImage.source
    return () => { cancelled = true }
  }, [pendingImage, imageZoom, onMessage])

  function update(index: number, field: keyof ProductRow, value: string) {
    setRows((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  function uploadImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return onMessage('Selecione um arquivo de imagem válido.')

    const reader = new FileReader()
    reader.onload = () => {
      const source = String(reader.result || '')
      if (!source) return onMessage('Não foi possível ler a imagem selecionada.')
      setImageZoom(1)
      setPendingImage({ index, source })
    }
    reader.onerror = () => onMessage('Não foi possível ler a imagem selecionada.')
    reader.readAsDataURL(file)
  }

  function openImageEditor(index: number, source: string) {
    if (!source) return
    setImageZoom(1)
    setPendingImage({ index, source })
  }

  function applyImageEdit() {
    const canvas = imageCanvasRef.current
    if (!pendingImage || !canvas || !imageReady) return onMessage('Aguarde a prévia da imagem terminar de carregar.')
    try {
      update(pendingImage.index, 'image', canvas.toDataURL('image/jpeg', 0.95))
      setPendingImage(null)
      onMessage('Imagem preparada no padrão quadrado. Complete a linha e salve o cadastro para confirmar.')
    } catch {
      onMessage('Não foi possível preparar a imagem. Tente usar um arquivo local em JPG ou PNG.')
    }
  }

  function addRow() {
    setRows((items) => [...items, blank()])
  }

  function removeRow(index: number) {
    setRows((items) => (items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items))
    setPendingImage((current) => current ? current.index === index ? null : current.index > index ? { ...current, index: current.index - 1 } : current : null)
  }

  async function saveAll() {
    const valid = rows.filter(
      (row) =>
        row.name.trim() &&
        row.brand.trim() &&
        row.price.trim() &&
        row.image.trim() &&
        row.description.trim() &&
        row.specifications.trim() &&
        row.weightKg.trim() &&
        row.heightCm.trim() &&
        row.widthCm.trim() &&
        row.lengthCm.trim()
    )

    if (!valid.length) return onMessage('Preencha pelo menos uma linha completa para cadastrar.')
    if (valid.length !== rows.length) return onMessage('Complete ou remova as linhas vazias antes de salvar.')

    for (const [index, row] of valid.entries()) {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...row,
          specifications: row.specifications.trim(),
          price: Number(String(row.price).replace(',', '.')),
          weightKg: Number(String(row.weightKg).replace(',', '.')),
          heightCm: Number(String(row.heightCm).replace(',', '.')),
          widthCm: Number(String(row.widthCm).replace(',', '.')),
          lengthCm: Number(String(row.lengthCm).replace(',', '.')),
          active: true
        })
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        return onMessage(`Falha na peça ${index + 1}: ${result.error || 'não foi possível cadastrar.'}`)
      }
    }

    setRows([blank(), blank()])
    onMessage(`${valid.length} peças cadastradas com sucesso.`)
  }

  return (
    <div className="bulk-products">
      <div className="lead-toolbar">
        <div>
          <h2>Cadastro</h2>
          <p className="form-hint">Informe peso em kg e dimensões da embalagem em cm para preparar a cotação de frete.</p>
        </div>
        <button className="outline-button" type="button" onClick={addRow}>Adicionar linha</button>
      </div>

      <div className="bulk-table">
        <div className="bulk-head">
          <span>Nome</span>
          <span>Código interno</span>
          <span>Marca</span>
          <span>Categoria</span>
          <span>Modelos compatíveis</span>
          <span>Preço</span>
          <span>Peso (kg)</span>
          <span>Altura (cm)</span>
          <span>Largura (cm)</span>
          <span>Comprimento (cm)</span>
          <span>Imagem</span>
          <span>Descrição</span>
          <span>Especificações</span>
          <span />
        </div>

        {rows.map((row, index) => (
          <div className="bulk-row" key={index}>
            <input value={row.name} onChange={(event) => update(index, 'name', event.target.value)} placeholder="Inversor" />
            <input value={row.internalCode} onChange={(event) => update(index, 'internalCode', event.target.value)} placeholder="AT-EST-001" />
            <input value={row.brand} onChange={(event) => update(index, 'brand', event.target.value)} placeholder="Movement" />
            <div className="bulk-category-checkboxes">
              {categories.map((category) => <label key={category}><input type="checkbox" checked={getProductCategories(row.category).includes(category)} onChange={() => update(index, 'category', toggleCategory(row.category, category))} /> {category}</label>)}
            </div>
            <textarea className="bulk-description-input" value={row.compatibleEquipment} onChange={(event) => update(index, 'compatibleEquipment', event.target.value)} placeholder={'Um modelo por linha'} />
            <input type="number" min="0.001" step="0.001" value={row.price} onChange={(event) => update(index, 'price', event.target.value)} placeholder="0,00" />
            <input type="number" min={CORREIOS_PACKAGE_DEFAULTS.weightKg} step="0.001" value={row.weightKg} onChange={(event) => update(index, 'weightKg', event.target.value)} />
            <input type="number" min={CORREIOS_PACKAGE_DEFAULTS.heightCm} step="0.1" value={row.heightCm} onChange={(event) => update(index, 'heightCm', event.target.value)} />
            <input type="number" min={CORREIOS_PACKAGE_DEFAULTS.widthCm} step="0.1" value={row.widthCm} onChange={(event) => update(index, 'widthCm', event.target.value)} />
            <input type="number" min={CORREIOS_PACKAGE_DEFAULTS.lengthCm} step="0.1" value={row.lengthCm} onChange={(event) => update(index, 'lengthCm', event.target.value)} />
            <div className="bulk-image-cell">
              <input className="bulk-file-input" type="file" accept="image/*" onChange={(event) => uploadImage(index, event)} />
              {row.image && <>
                <img src={row.image} alt={`Imagem de ${row.name || 'produto'}`} />
                <button type="button" onClick={() => openImageEditor(index, row.image)}>Editar para site</button>
              </>}
            </div>
            <textarea className="bulk-description-input" value={row.description} onChange={(event) => update(index, 'description', event.target.value)} placeholder="Descrição resumida" />
            <textarea className="bulk-description-input" value={row.specifications} onChange={(event) => update(index, 'specifications', event.target.value)} placeholder={'Tensão: 220V\nPotência: 2,2HP'} />
            <button className="bulk-remove-button" type="button" onClick={() => removeRow(index)} aria-label="Remover linha">
              ×
            </button>
          </div>
        ))}
      </div>

      {pendingImage && <div className="admin-site-image-editor bulk-site-image-editor">
        <canvas ref={imageCanvasRef} className="admin-site-image-canvas" aria-label="Prévia quadrada da imagem editada para site" />
        <div className="admin-site-image-controls">
          <strong>Prévia para e-commerce · 1200 × 1200</strong>
          <label>Enquadramento<input type="range" min="0.7" max="1.12" step="0.01" value={imageZoom} onChange={(event) => setImageZoom(Number(event.target.value))} /><small>Ampliação {Math.round(imageZoom * 100)}% · mantenha a peça dentro da margem de segurança.</small></label>
          <p className="form-hint">O produto é preservado sem deformação. O fundo da foto original não é removido automaticamente.</p>
          <div className="admin-site-image-actions">
            <button className="primary-button" type="button" disabled={!imageReady} onClick={applyImageEdit}>Usar imagem editada</button>
            <button className="outline-button" type="button" onClick={() => setPendingImage(null)}>Cancelar</button>
          </div>
        </div>
      </div>}

      <div className="lead-toolbar" style={{ marginTop: 20 }}>
        <div />
        <button className="primary-button" type="button" onClick={saveAll}>Salvar cadastro</button>
      </div>
    </div>
  )
}
