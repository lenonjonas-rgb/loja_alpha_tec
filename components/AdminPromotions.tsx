import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../lib/products'

type Props = { products: Product[]; onMessage: (message: string) => void }
type PostFormat = 'portrait' | 'square'
type Coupon = { code: string; discount_percent: number; active: boolean; free_shipping: boolean; expires_at: string | null; usage_limit: number | null; used_count: number }

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
  const [coupons, setCoupons] = useState<Coupon[]>([])
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
  const normalizedCoupon = coupon.trim().toUpperCase()
  const matchedCoupon = coupons.find((item) => item.active && item.code.toUpperCase() === normalizedCoupon)
  const couponDiscountPercent = Number(matchedCoupon?.discount_percent || 0)
  const couponBenefit = matchedCoupon?.free_shipping ? 'FRETE GRÁTIS' : couponDiscountPercent > 0 ? `${couponDiscountPercent}% OFF` : ''

  useEffect(() => {
    if (!selectedProduct && activeProducts[0]) setSelectedId(activeProducts[0].id)
  }, [activeProducts, selectedProduct])

  useEffect(() => {
    fetch('/api/coupons-admin')
      .then((response) => response.ok ? response.json() : [])
      .then((items) => setCoupons(Array.isArray(items) ? items : []))
      .catch(() => setCoupons([]))
  }, [])

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
      context.fillStyle = '#f4f0e9'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#17191c'
      context.fillRect(0, 0, width, format === 'portrait' ? 470 : 400)
      context.fillStyle = '#d83232'
      context.fillRect(0, 0, width, 18)
      context.fillStyle = '#ffffff'
      context.font = '800 28px Arial, sans-serif'
      context.fillText('ALPHA TEC', 72, 78)
      context.fillStyle = '#f6c548'
      context.font = '800 22px Arial, sans-serif'
      context.fillText(headline.trim().toUpperCase() || 'OFERTA ESPECIAL', 72, 128)
      context.fillStyle = '#aeb3b8'
      context.font = '500 20px Arial, sans-serif'
      context.fillText('PEÇAS QUE MANTÊM SEU TREINO EM MOVIMENTO', 72, 168)

      const imageBox = { x: 72, y: 222, width: width - 144, height: format === 'portrait' ? 430 : 350 }
      context.fillStyle = '#ffffff'
      context.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      context.fillStyle = '#d83232'
      context.fillRect(imageBox.x, imageBox.y, 12, imageBox.height)
      if (image) drawImageContain(context, image, imageBox.x + 42, imageBox.y + 28, imageBox.width - 84, imageBox.height - 56)
      else {
        context.fillStyle = '#7b8086'
        context.font = '600 24px Arial, sans-serif'
        context.textAlign = 'center'
        context.fillText('IMAGEM DO PRODUTO', width / 2, imageBox.y + imageBox.height / 2)
        context.textAlign = 'left'
      }

      let cursor = imageBox.y + imageBox.height + 62
      context.fillStyle = '#17191c'
      context.font = '800 48px Arial, sans-serif'
      const nameLines = wrapText(context, selectedProduct.name, width - 144).slice(0, 3)
      nameLines.forEach((line) => { context.fillText(line, 72, cursor); cursor += 58 })
      context.fillStyle = '#6f7479'
      context.font = '700 21px Arial, sans-serif'
      const category = selectedProduct.brand ? `${selectedProduct.brand}  /  ${selectedProduct.category}` : selectedProduct.category
      context.fillText(category.toUpperCase(), 72, cursor + 4)
      cursor += 68

      if (hasDiscount) {
        context.fillStyle = '#d83232'
        context.font = '800 23px Arial, sans-serif'
        context.fillText(`OFERTA ESPECIAL  -${discountPercent}%`, 72, cursor)
        cursor += 40
        context.fillStyle = '#6f7479'
        context.font = '500 26px Arial, sans-serif'
        context.fillText(money(originalPrice), 72, cursor)
        cursor += 51
      }
      context.fillStyle = '#17191c'
      context.font = '800 58px Arial, sans-serif'
      context.fillText(originalPrice > 0 ? money(finalPrice) : 'CONSULTE O PREÇO', 72, cursor)
      cursor += 68

      if (normalizedCoupon) {
        context.fillStyle = matchedCoupon ? '#d83232' : '#9a9da0'
        context.fillRect(72, cursor, width - 144, 78)
        context.fillStyle = '#ffffff'
        context.font = '800 22px Arial, sans-serif'
        context.fillText(matchedCoupon ? `CUPOM  ${normalizedCoupon}` : `CUPOM  ${normalizedCoupon}`, 98, cursor + 32)
        context.font = '800 25px Arial, sans-serif'
        context.fillText(matchedCoupon ? (couponBenefit || 'VANTAGEM ESPECIAL') : 'CONFIRA AS CONDIÇÕES', 98, cursor + 61)
      }

      context.fillStyle = '#17191c'
      context.font = '800 24px Arial, sans-serif'
      context.fillText('COMPRE AGORA', 72, height - 76)
      context.fillStyle = '#d83232'
      context.fillRect(width - 290, height - 100, 218, 5)
      context.fillStyle = '#6f7479'
      context.font = '500 20px Arial, sans-serif'
      context.fillText('lojaalphatec.com.br', width - 360, height - 40)
      setCanvasReady(true)
    }

    if (!selectedProduct.image) return draw()
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => draw(image)
    image.onerror = () => draw()
    image.src = selectedProduct.image
  }, [coupon, couponBenefit, format, headline, hasDiscount, originalPrice, normalizedCoupon, selectedFormat, selectedProduct, discountPercent, matchedCoupon])

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
          <label>Cupom de desconto<input value={coupon} maxLength={20} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="EX.: ALPHA10" />{normalizedCoupon && <small className={`promotion-coupon-status ${matchedCoupon ? 'valid' : 'invalid'}`}>{matchedCoupon ? `Cupom válido: ${couponBenefit || 'benefício cadastrado'}` : 'Cupom não encontrado ou inativo'}</small>}</label>
          <label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as PostFormat)}>{formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.width} x {option.height})</option>)}</select></label>
          <label className="promotion-toggle"><input type="checkbox" checked={showDiscount} onChange={(event) => setShowDiscount(event.target.checked)} /> Mostrar desconto cadastrado{discountPercent > 0 ? ` (-${discountPercent}%)` : ' (este produto não tem desconto)'}</label>
          <div className="promotion-product-summary"><span>Preço atual</span><strong>{originalPrice > 0 ? money(finalPrice) : 'Consulte o preço'}</strong>{hasDiscount && <small>De {money(originalPrice)} por {money(finalPrice)}</small>}</div>
          <p className="form-hint">A porcentagem exibida vem do cupom salvo na aba Cupons. O post não aceita valores inventados e identifica quando o código ainda não existe.</p>
        </div>
        <div className="promotion-preview-panel">
          <div className="promotion-preview-toolbar"><span>Prévia do post</span><small>{selectedFormat.width} x {selectedFormat.height}px</small></div>
          <canvas ref={canvasRef} className="promotion-canvas" aria-label="Prévia do post promocional" />
        </div>
      </div>}
    </div>
  )
}
