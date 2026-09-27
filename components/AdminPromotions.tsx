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

function drawFittedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxHeight: number, color: string, maxFontSize: number) {
  let fontSize = maxFontSize
  let lines: string[] = []
  let lineHeight = fontSize + 4
  for (; fontSize >= 10; fontSize -= 1) {
    context.font = `500 ${fontSize}px Arial, sans-serif`
    lines = wrapText(context, text, maxWidth)
    lineHeight = fontSize + 4
    if (lines.length * lineHeight <= maxHeight) break
  }
  context.fillStyle = color
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
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
  const couponUsageLimit = Number(matchedCoupon?.usage_limit) > 0 ? Number(matchedCoupon?.usage_limit) : null
  const couponDiscountPercent = Number(matchedCoupon?.discount_percent || 0)
  const couponBenefit = matchedCoupon?.free_shipping ? 'FRETE GRÁTIS' : couponDiscountPercent > 0 ? `${couponDiscountPercent}% OFF` : ''
  const priceBeforeCoupon = hasDiscount ? finalPrice : originalPrice
  const hasCouponDiscount = Boolean(matchedCoupon && couponDiscountPercent > 0)
  const promotionalPrice = hasCouponDiscount ? priceBeforeCoupon * (1 - couponDiscountPercent / 100) : priceBeforeCoupon
  const caption = useMemo(() => {
    if (!selectedProduct) return ''
    const lines = ['🛒 ACESSE AGORA: www.lojaalphatec.com.br', '', `🔥 ${headline.trim().toUpperCase() || 'OFERTA ESPECIAL'}: ${selectedProduct.name}!`, '']
    if (selectedProduct.description) lines.push(selectedProduct.description.trim(), '')
    if (hasDiscount) {
      lines.push(`💥 De ${money(originalPrice)} por ${money(priceBeforeCoupon)}: ${discountPercent}% de desconto no produto.`)
    } else if (hasCouponDiscount) {
      lines.push(`💥 De ${money(originalPrice)} por ${money(promotionalPrice)} usando o cupom ${normalizedCoupon}: ${couponDiscountPercent}% de desconto.`)
    } else if (originalPrice > 0) lines.push(`💥 Garanta o seu por ${money(promotionalPrice)}.`)
    if (matchedCoupon) {
      if (matchedCoupon.free_shipping) lines.push(`🚚 Use o cupom ${normalizedCoupon} e ganhe FRETE GRÁTIS.`)
      else if (couponDiscountPercent > 0 && hasDiscount) lines.push(`🎯 Com o cupom ${normalizedCoupon}, ganhe mais ${couponDiscountPercent}% e pague apenas ${money(promotionalPrice)}.`)
      else if (couponDiscountPercent > 0) lines.push(`🎁 Use o cupom ${normalizedCoupon} e ganhe ${couponDiscountPercent}% de desconto.`)
      else lines.push(`🎁 Use o cupom ${normalizedCoupon} e aproveite essa condição especial.`)
      if (couponUsageLimit) lines.push(`⏳ Cupom válido para os primeiros ${couponUsageLimit} clientes.`)
    }
    lines.push('', 'Garanta sua peça e mantenha seu treino em movimento.', '', '#AlphaTec #PecasFitness #Academia #EquipamentosFitness')
    return lines.join('\n')
  }, [couponDiscountPercent, couponUsageLimit, discountPercent, hasCouponDiscount, hasDiscount, headline, matchedCoupon, normalizedCoupon, originalPrice, priceBeforeCoupon, promotionalPrice, selectedProduct])

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
      context.fillStyle = '#090a0c'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#d83232'
      context.fillRect(0, 0, width, 16)
      context.fillStyle = '#ffffff'
      context.font = '800 30px Arial, sans-serif'
      context.fillText('ALPHA TEC', 72, 72)
      context.fillStyle = '#7f858b'
      context.font = '700 18px Arial, sans-serif'
      context.fillText('PEÇAS E ACESSÓRIOS FITNESS', 72, 105)

      const squareLayout = format === 'square'
      const nameX = 72
      let nameY = squareLayout ? 156 : 174
      context.fillStyle = '#ffffff'
      let nameFontSize = squareLayout ? 52 : 58
      let nameLines: string[]
      do {
        context.font = `800 ${nameFontSize}px Arial, sans-serif`
        nameLines = wrapText(context, selectedProduct.name.toUpperCase(), width - 144)
        if (nameLines.length <= 3 || nameFontSize <= 38) break
        nameFontSize -= 2
      } while (true)
      const nameLineHeight = squareLayout ? nameFontSize + 6 : 66
      nameLines.forEach((line) => { context.fillText(line, nameX, nameY); nameY += nameLineHeight })
      context.fillStyle = '#d83232'
      context.fillRect(nameX, nameY + 2, squareLayout ? 180 : 240, 6)
      context.fillStyle = '#aeb3b8'
      context.font = `700 ${squareLayout ? 17 : 20}px Arial, sans-serif`
      const category = selectedProduct.brand ? `${selectedProduct.brand}  /  ${selectedProduct.category}` : selectedProduct.category
      const categoryY = nameY + (squareLayout ? 36 : 42)
      context.fillText(category.toUpperCase(), nameX, categoryY)

      const imageBox = { x: 42, y: categoryY + (squareLayout ? 34 : 33), width: width - 84, height: format === 'portrait' ? 470 : 235 }
      context.fillStyle = '#111316'
      context.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      context.strokeStyle = '#33373b'
      context.lineWidth = 2
      context.strokeRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      if (image) drawImageContain(context, image, imageBox.x + 34, imageBox.y + 24, imageBox.width - 68, imageBox.height - 48)
      else {
        context.fillStyle = '#73787e'
        context.font = '600 24px Arial, sans-serif'
        context.textAlign = 'center'
        context.fillText('IMAGEM DO PRODUTO', width / 2, imageBox.y + imageBox.height / 2)
        context.textAlign = 'left'
      }

      const detailsHeadingY = imageBox.y + imageBox.height + (squareLayout ? 42 : 48)
      const detailsTextY = detailsHeadingY + (squareLayout ? 29 : 35)
      const footerY = squareLayout ? height - 188 : height - 190
      context.fillStyle = '#d83232'
      context.font = `800 ${squareLayout ? 18 : 21}px Arial, sans-serif`
      context.fillText('ESPECIFICAÇÕES', 72, detailsHeadingY)
      const detailsWidth = width / 2 - 120
      const specificationText = selectedProduct.specifications || selectedProduct.description || 'Peça de qualidade para manter seu equipamento em movimento.'
      const detailsX = width / 2 + 24
      context.fillStyle = '#d83232'
      context.font = `800 ${squareLayout ? 18 : 21}px Arial, sans-serif`
      context.fillText('PRINCIPAIS UTILIZAÇÕES', detailsX, detailsHeadingY)
      const usageText = selectedProduct.compatibleEquipment || selectedProduct.category || 'Equipamentos fitness'
      if (squareLayout) {
        const detailsHeight = Math.max(24, footerY - detailsTextY - 54)
        drawFittedText(context, specificationText, 72, detailsTextY, detailsWidth, detailsHeight, '#b7bcc1', 16)
        drawFittedText(context, `• ${usageText.replace(/\r?\n/g, ' · ')}`, detailsX, detailsTextY, width - detailsX - 72, detailsHeight, '#b7bcc1', 16)
      } else {
        let cursor = detailsTextY
        context.fillStyle = '#b7bcc1'
        context.font = '500 19px Arial, sans-serif'
        wrapText(context, specificationText, detailsWidth).slice(0, 5).forEach((line) => { context.fillText(line, 72, cursor); cursor += 27 })
        context.font = '500 18px Arial, sans-serif'
        wrapText(context, usageText, width - detailsX - 72).slice(0, 5).forEach((line, index) => context.fillText(`• ${line}`, detailsX, detailsTextY + index * 26))
      }

      if (hasDiscount || hasCouponDiscount) {
        context.fillStyle = '#7f858b'
        context.font = '500 28px Arial, sans-serif'
        const previousPriceText = `DE ${money(priceBeforeCoupon)}`
        context.fillText(previousPriceText, 72, footerY)
        const previousPriceWidth = context.measureText(previousPriceText).width
        context.strokeStyle = '#d83232'
        context.lineWidth = 4
        context.beginPath()
        context.moveTo(72, footerY - 10)
        context.lineTo(72 + previousPriceWidth, footerY - 10)
        context.stroke()
        context.fillStyle = '#f6c548'
        context.font = '800 48px Arial, sans-serif'
        context.fillText(originalPrice > 0 ? `POR ${money(promotionalPrice)}` : 'CONSULTE O PREÇO', 72 + previousPriceWidth + 38, footerY)
      } else {
        context.fillStyle = '#ffffff'
        context.font = '800 48px Arial, sans-serif'
        context.fillText(originalPrice > 0 ? money(promotionalPrice) : 'CONSULTE O PREÇO', 72, footerY)
      }
      if (normalizedCoupon) {
        context.fillStyle = matchedCoupon ? '#d83232' : '#555b61'
        context.fillRect(72, footerY + 22, width - 144, couponUsageLimit ? 124 : 86)
        context.fillStyle = '#ffffff'
        context.font = '800 21px Arial, sans-serif'
        context.fillText(`UTILIZE O CUPOM  ${normalizedCoupon}`, 96, footerY + 54)
        context.font = '800 24px Arial, sans-serif'
        context.fillText(matchedCoupon ? (matchedCoupon.free_shipping ? 'E GANHE FRETE GRÁTIS. APROVEITE!' : `E GANHE ${couponDiscountPercent}% DE DESCONTO. APROVEITE!`) : 'CONFIRA AS CONDIÇÕES', 96, footerY + 86)
        if (couponUsageLimit) {
          context.font = '700 18px Arial, sans-serif'
          context.fillText(`VÁLIDO PARA OS PRIMEIROS ${couponUsageLimit} CLIENTES`, 96, footerY + 118)
        }
      }
      context.fillStyle = '#d83232'
      context.fillRect(72, height - 32, 120, 4)
      context.fillStyle = '#f6c548'
      context.font = '800 23px Arial, sans-serif'
      context.fillText('ACESSE www.lojaalphatec.com.br', 216, height - 18)
      setCanvasReady(true)
    }

    if (!selectedProduct.image) return draw()
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => draw(image)
    image.onerror = () => draw()
    image.src = selectedProduct.image
  }, [coupon, couponBenefit, couponDiscountPercent, couponUsageLimit, format, headline, hasCouponDiscount, hasDiscount, originalPrice, normalizedCoupon, priceBeforeCoupon, promotionalPrice, selectedFormat, selectedProduct, discountPercent, matchedCoupon])

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

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption)
      onMessage('Legenda copiada para a área de transferência.')
    } catch {
      onMessage('Não foi possível copiar automaticamente. Selecione o texto da legenda para copiar.')
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
          <div className="promotion-product-summary"><span>Preço para o post</span><strong>{originalPrice > 0 ? money(promotionalPrice) : 'Consulte o preço'}</strong>{(hasDiscount || hasCouponDiscount) && <small>De {money(priceBeforeCoupon)} por {money(promotionalPrice)}{hasCouponDiscount ? ` com cupom -${couponDiscountPercent}%` : ''}</small>}</div>
          <p className="form-hint">A porcentagem exibida vem do cupom salvo na aba Cupons. O post não aceita valores inventados e identifica quando o código ainda não existe.</p>
        </div>
        <div className="promotion-preview-panel">
          <div className="promotion-preview-toolbar"><span>Prévia do post</span><small>{selectedFormat.width} x {selectedFormat.height}px</small></div>
          <canvas ref={canvasRef} className="promotion-canvas" aria-label="Prévia do post promocional" />
          <div className="promotion-caption-panel">
            <div className="promotion-preview-toolbar"><span>Legenda para Instagram</span><button type="button" onClick={() => void copyCaption()}>Copiar legenda</button></div>
            <textarea value={caption} onChange={() => undefined} readOnly aria-label="Legenda gerada para Instagram" />
          </div>
        </div>
      </div>}
    </div>
  )
}
