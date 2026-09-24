import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../lib/products'

type Props = { products: Product[]; onMessage: (message: string) => void }
type PostFormat = 'portrait' | 'square'

const formatOptions: { value: PostFormat; label: string; width: number; height: number }[] = [
  { value: 'portrait', label: 'Feed vertical', width: 1080, height: 1350 },
  { value: 'square', label: 'Feed quadrado', width: 1080, height: 1080 },
]

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

function drawImageContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

export default function AdminPromotions({ products, onMessage }: Props) {
  const activeProducts = useMemo(() => products.filter((product) => product.active !== false), [products])
  const [selectedId, setSelectedId] = useState(activeProducts[0]?.id || '')
  const [headline, setHeadline] = useState('OFERTA ESPECIAL')
  const [coupon, setCoupon] = useState('')
  const [showDiscount, setShowDiscount] = useState(true)
  const [format, setFormat] = useState<PostFormat>('portrait')
  const [canvasReady, setCanvasReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selectedProduct = activeProducts.find((product) => product.id === selectedId) || activeProducts[0]
  const selectedFormat = formatOptions.find((option) => option.value === format) || formatOptions[0]
  const originalPrice = Number(selectedProduct?.price || 0)
  const discountPercent = Number(selectedProduct?.discountPercent || 0)
  const hasDiscount = showDiscount && discountPercent > 0
  const finalPrice = hasDiscount ? originalPrice * (1 - discountPercent / 100) : originalPrice

  useEffect(() => {
    if (!selectedProduct && activeProducts[0]) setSelectedId(activeProducts[0].id)
  }, [activeProducts, selectedProduct])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedProduct) return
    const { width, height } = selectedFormat
    canvas.width = width
    canvas.height = height
    setCanvasReady(false)
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = (image?: HTMLImageElement) => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#16181b'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#d83232'
      context.fillRect(0, 0, width, 18)
      context.fillStyle = '#ffffff'
      context.font = '800 28px Arial, sans-serif'
      context.letterSpacing = '4px'
      context.fillText('ALPHA TEC', 72, 76)
      context.letterSpacing = '0px'
      context.fillStyle = '#d83232'
      context.font = '800 22px Arial, sans-serif'
      context.fillText(headline.trim().toUpperCase() || 'OFERTA ESPECIAL', 72, 128)

      const imageBox = { x: 72, y: 174, width: width - 144, height: format === 'portrait' ? 480 : 390 }
      context.fillStyle = '#f1f1ef'
      context.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      if (image) drawImageContain(context, image, imageBox.x + 34, imageBox.y + 34, imageBox.width - 68, imageBox.height - 68)
      else {
        context.fillStyle = '#7b8086'
        context.font = '600 24px Arial, sans-serif'
        context.textAlign = 'center'
        context.fillText('IMAGEM DO PRODUTO', width / 2, imageBox.y + imageBox.height / 2)
        context.textAlign = 'left'
      }

      let cursor = imageBox.y + imageBox.height + 62
      context.fillStyle = '#ffffff'
      context.font = '800 48px Arial, sans-serif'
      const nameLines = wrapText(context, selectedProduct.name, width - 144).slice(0, 3)
      nameLines.forEach((line) => { context.fillText(line, 72, cursor); cursor += 58 })
      context.fillStyle = '#aeb3b8'
      context.font = '500 24px Arial, sans-serif'
      const category = selectedProduct.brand ? `${selectedProduct.brand}  /  ${selectedProduct.category}` : selectedProduct.category
      context.fillText(category.toUpperCase(), 72, cursor + 4)
      cursor += 68

      if (hasDiscount) {
        context.fillStyle = '#d83232'
        context.font = '800 24px Arial, sans-serif'
        context.fillText(`OFERTA  -${discountPercent}%`, 72, cursor)
        cursor += 42
        context.fillStyle = '#aeb3b8'
        context.font = '500 27px Arial, sans-serif'
        context.fillText(money(originalPrice), 72, cursor)
        cursor += 55
      }
      context.fillStyle = '#ffffff'
      context.font = '800 58px Arial, sans-serif'
      context.fillText(originalPrice > 0 ? money(finalPrice) : 'CONSULTE O PREÇO', 72, cursor)
      cursor += 58

      if (coupon.trim()) {
        context.fillStyle = '#f6c548'
        context.fillRect(72, cursor, width - 144, 62)
        context.fillStyle = '#16181b'
        context.font = '800 25px Arial, sans-serif'
        context.fillText(`USE O CUPOM  ${coupon.trim().toUpperCase()}`, 96, cursor + 40)
        cursor += 96
      }

      context.fillStyle = '#ffffff'
      context.font = '800 24px Arial, sans-serif'
      context.fillText('COMPRE AGORA', 72, height - 74)
      context.fillStyle = '#d83232'
      context.fillRect(width - 260, height - 94, 188, 4)
      context.fillStyle = '#aeb3b8'
      context.font = '500 20px Arial, sans-serif'
      context.fillText('lojaalphatec.com.br', width - 360, height - 42)
      setCanvasReady(true)
    }

    if (!selectedProduct.image) return draw()
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => draw(image)
    image.onerror = () => draw()
    image.src = selectedProduct.image
  }, [coupon, format, headline, hasDiscount, originalPrice, selectedFormat, selectedProduct, discountPercent])

  function handleProductChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedId(event.target.value)
  }

  function downloadPost() {
    const canvas = canvasRef.current
    if (!canvas || !canvasReady || !selectedProduct) return onMessage('Aguarde a prévia do post terminar de carregar.')
    try {
      const link = document.createElement('a')
      link.download = `post-${selectedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'alpha-tec'}.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      link.remove()
      onMessage('Post promocional gerado e baixado em PNG.')
    } catch {
      onMessage('Não foi possível gerar o PNG. Verifique se a imagem do produto permite uso externo.')
    }
  }

  return (
    <div className="promotion-studio">
      <div className="promotion-studio-header">
        <div>
          <p className="eyebrow">CONTEÚDO PARA INSTAGRAM</p>
          <h2>Posts promocionais</h2>
          <p className="form-hint">Escolha uma peça, destaque o preço e crie uma arte pronta para publicar.</p>
        </div>
        <button className="primary-button" type="button" onClick={downloadPost}>Gerar post para Instagram <span>↓</span></button>
      </div>

      {!activeProducts.length ? <p className="form-hint">Cadastre pelo menos um produto ativo para criar um post.</p> : <div className="promotion-studio-layout">
        <div className="promotion-controls">
          <h3>Configuração da oferta</h3>
          <label>Produto<select value={selectedProduct?.id || ''} onChange={handleProductChange}>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Chamada principal<input value={headline} maxLength={34} onChange={(event) => setHeadline(event.target.value)} placeholder="OFERTA ESPECIAL" /></label>
          <label>Cupom de desconto<input value={coupon} maxLength={20} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="EX.: ALPHA10" /></label>
          <label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as PostFormat)}>{formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.width} x {option.height})</option>)}</select></label>
          <label className="promotion-toggle"><input type="checkbox" checked={showDiscount} onChange={(event) => setShowDiscount(event.target.checked)} /> Mostrar desconto cadastrado{discountPercent > 0 ? ` (-${discountPercent}%)` : ' (este produto não tem desconto)'}</label>
          <div className="promotion-product-summary"><span>Preço atual</span><strong>{originalPrice > 0 ? money(finalPrice) : 'Consulte o preço'}</strong>{hasDiscount && <small>De {money(originalPrice)} por {money(finalPrice)}</small>}</div>
          <p className="form-hint">A arte usa o desconto salvo no cadastro. O cupom aparece no post como incentivo adicional e precisa estar criado na aba Cupons.</p>
        </div>
        <div className="promotion-preview-panel">
          <div className="promotion-preview-toolbar"><span>Prévia do post</span><small>{selectedFormat.width} x {selectedFormat.height}px</small></div>
          <canvas ref={canvasRef} className="promotion-canvas" aria-label="Prévia do post promocional" />
        </div>
      </div>}
    </div>
  )
}
