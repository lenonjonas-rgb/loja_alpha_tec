import { ChangeEvent, useState } from 'react'

type ProductRow = {
  name: string
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

const categories = ['Esteiras', 'Musculação', 'Bicicletas', 'Acessórios', 'Peças diversas']

const blank = (): ProductRow => ({
  name: '',
  brand: '',
  category: categories[0],
  compatibleEquipment: '',
  price: '',
  image: '',
  description: '',
  specifications: '',
  weightKg: '',
  heightCm: '',
  widthCm: '',
  lengthCm: ''
})

export default function AdminBulkProducts({ onMessage }: Props) {
  const [rows, setRows] = useState<ProductRow[]>([blank(), blank()])

  function update(index: number, field: keyof ProductRow, value: string) {
    setRows((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  function uploadImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return onMessage('Selecione um arquivo de imagem válido.')

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return onMessage('Não foi possível preparar a imagem.')

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        update(index, 'image', canvas.toDataURL('image/jpeg', 0.78))
      }

      image.onerror = () => onMessage('Não foi possível ler a imagem selecionada.')
      image.src = String(reader.result)
    }

    reader.readAsDataURL(file)
  }

  function addRow() {
    setRows((items) => [...items, blank()])
  }

  function removeRow(index: number) {
    setRows((items) => (items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items))
  }

  async function saveAll() {
    const valid = rows.filter(
      (row) =>
        row.name.trim() &&
        row.brand.trim() &&
        row.compatibleEquipment.trim() &&
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
          <span>Marca</span>
          <span>Categoria</span>
          <span>Compatibilidade</span>
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
            <input value={row.brand} onChange={(event) => update(index, 'brand', event.target.value)} placeholder="Movement" />
            <select value={row.category} onChange={(event) => update(index, 'category', event.target.value)}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <input value={row.compatibleEquipment} onChange={(event) => update(index, 'compatibleEquipment', event.target.value)} placeholder="Modelo" />
            <input type="number" min="0.001" step="0.001" value={row.price} onChange={(event) => update(index, 'price', event.target.value)} placeholder="0,00" />
            <input type="number" min="0.001" step="0.001" value={row.weightKg} onChange={(event) => update(index, 'weightKg', event.target.value)} placeholder="0,500" />
            <input type="number" min="0.1" step="0.1" value={row.heightCm} onChange={(event) => update(index, 'heightCm', event.target.value)} placeholder="10" />
            <input type="number" min="0.1" step="0.1" value={row.widthCm} onChange={(event) => update(index, 'widthCm', event.target.value)} placeholder="10" />
            <input type="number" min="0.1" step="0.1" value={row.lengthCm} onChange={(event) => update(index, 'lengthCm', event.target.value)} placeholder="10" />
            <input className="bulk-file-input" type="file" accept="image/*" onChange={(event) => uploadImage(index, event)} />
            <textarea className="bulk-description-input" value={row.description} onChange={(event) => update(index, 'description', event.target.value)} placeholder="Descrição resumida" />
            <textarea className="bulk-description-input" value={row.specifications} onChange={(event) => update(index, 'specifications', event.target.value)} placeholder={'Tensão: 220V\nPotência: 2,2HP'} />
            <button className="bulk-remove-button" type="button" onClick={() => removeRow(index)} aria-label="Remover linha">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="lead-toolbar" style={{ marginTop: 20 }}>
        <div />
        <button className="primary-button" type="button" onClick={saveAll}>Salvar cadastro</button>
      </div>
    </div>
  )
}
