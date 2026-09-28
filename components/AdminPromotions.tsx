import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getProductCategories, hasProductCategory } from '../lib/products'
import type { Product } from '../lib/products'

type Props = { products: Product[]; onMessage: (message: string) => void }
type PostFormat = 'portrait' | 'square'
type PostMode = 'product' | 'category'
type Coupon = { code: string; discount_percent: number; active: boolean; free_shipping: boolean; expires_at: string | null; usage_limit: number | null; used_count: number }

const formatOptions: { value: PostFormat; label: string; width: number; height: number }[] = [
  { value: 'portrait', label: 'Feed vertical', width: 1080, height: 1350 },
  { value: 'square', label: 'Feed quadrado', width: 1080, height: 1080 },
]

const categoryAccentColors = ['#d83232', '#f6c548', '#3ba7ff', '#4fd67a', '#c76bff', '#ff8a3d']
const categoryTaglines = [
  'Renove seu equipamento sem complicação.',
  'Peças originais, treino sem parar.',
  'Qualidade que mantém seu equipamento em movimento.',
  'Selecionamos o que há de melhor para você.',
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
  const categories = useMemo(
    () => Array.from(new Set(activeProducts.flatMap((product) => getProductCategories(product.category)))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [activeProducts]
  )
  const [mode, setMode] = useState<PostMode>('product')
  const [selectedId, setSelectedId] = useState(activeProducts[0]?.id || '')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCategoryProductIds, setSelectedCategoryProductIds] = useState<string[]>([])
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
  const maxCategoryProducts = 6
  const categoryAvailableProducts = useMemo(
    () => (selectedCategory ? activeProducts.filter((product) => hasProductCategory(product.category, selectedCategory)) : []),
    [activeProducts, selectedCategory]
  )
  const categoryProducts = useMemo(
    () => categoryAvailableProducts.filter((product) => selectedCategoryProductIds.includes(product.id)),
    [categoryAvailableProducts, selectedCategoryProductIds]
  )
  const getCategoryPricing = (product: Product) => {
    const original = Number(product.price || 0)
    const ownDiscount = showDiscount ? Number(product.discountPercent || 0) : 0
    const afterOwnDiscount = ownDiscount > 0 ? original * (1 - ownDiscount / 100) : original
    const final = hasCouponDiscount ? afterOwnDiscount * (1 - couponDiscountPercent / 100) : afterOwnDiscount
    return { original, final, hasAnyDiscount: ownDiscount > 0 || hasCouponDiscount }
  }
  function toggleCategoryProduct(productId: string) {
    setSelectedCategoryProductIds((current) => {
      if (current.includes(productId)) return current.filter((id) => id !== productId)
      if (current.length >= maxCategoryProducts) {
        onMessage(`Selecione no máximo ${maxCategoryProducts} peças por post.`)
        return current
      }
      return [...current, productId]
    })
  }
  const caption = useMemo(() => {
    if (mode === 'category') {
      if (!selectedCategory || !categoryProducts.length) return ''
      const tagline = categoryTaglines[categories.indexOf(selectedCategory) % categoryTaglines.length]
      const lines = ['🛒 ACESSE AGORA: www.lojaalphatec.com.br', '', `🔥 ${headline.trim().toUpperCase() || 'VITRINE DA SEMANA'}: linha completa de ${selectedCategory}!`, '', tagline, '']
      categoryProducts.forEach((product) => {
        const { original, final, hasAnyDiscount } = getCategoryPricing(product)
        const priceText = original > 0 ? (hasAnyDiscount ? `de ${money(original)} por ${money(final)}` : money(final)) : 'consulte o preço'
        lines.push(`✅ ${product.name} — ${priceText}`)
      })
      lines.push('')
      if (matchedCoupon) {
        if (matchedCoupon.free_shipping) lines.push(`🚚 Use o cupom ${normalizedCoupon} em qualquer peça da categoria e ganhe FRETE GRÁTIS.`)
        else if (couponDiscountPercent > 0) lines.push(`🎁 Use o cupom ${normalizedCoupon} e ganhe mais ${couponDiscountPercent}% de desconto em toda a linha.`)
        if (couponUsageLimit) lines.push(`⏳ Cupom válido para os primeiros ${couponUsageLimit} clientes.`)
        lines.push('')
      }
      lines.push('Escolha a sua peça e mantenha o equipamento sempre pronto para o treino.', '', `#AlphaTec #${selectedCategory.replace(/\s+/g, '')} #PecasFitness #Academia #EquipamentosFitness`)
      return lines.join('\n')
    }
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
  }, [mode, selectedCategory, categoryProducts, categories, couponDiscountPercent, couponUsageLimit, discountPercent, hasCouponDiscount, hasDiscount, headline, matchedCoupon, normalizedCoupon, originalPrice, priceBeforeCoupon, promotionalPrice, selectedProduct, showDiscount])

  useEffect(() => {
    if (!selectedProduct && activeProducts[0]) setSelectedId(activeProducts[0].id)
  }, [activeProducts, selectedProduct])

  useEffect(() => {
    if (!selectedCategory && categories[0]) setSelectedCategory(categories[0])
  }, [categories, selectedCategory])

  useEffect(() => {
    setSelectedCategoryProductIds((current) => {
      const stillValid = current.filter((id) => categoryAvailableProducts.some((product) => product.id === id))
      return stillValid.length ? stillValid : categoryAvailableProducts.slice(0, maxCategoryProducts).map((product) => product.id)
    })
  }, [categoryAvailableProducts])

  useEffect(() => {
    fetch('/api/coupons-admin')
      .then((response) => response.ok ? response.json() : [])
      .then((items) => setCoupons(Array.isArray(items) ? items : []))
      .catch(() => setCoupons([]))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (mode === 'category' && !categoryProducts.length) return
    if (mode === 'product' && !selectedProduct) return
    const { width, height } = selectedFormat
    canvas.width = width
    canvas.height = height
    setCanvasReady(false)
    const context = canvas.getContext('2d')
    if (!context) return

    if (mode === 'category') {
      const loadImage = (src?: string) => new Promise<HTMLImageElement | undefined>((resolve) => {
        if (!src) return resolve(undefined)
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = () => resolve(undefined)
        image.src = src
      })

      Promise.all(categoryProducts.map((product) => loadImage(product.image))).then((images) => {
        const squareLayout = format === 'square'
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

        const accent = categoryAccentColors[categories.indexOf(selectedCategory) % categoryAccentColors.length]
        const tagline = categoryTaglines[categories.indexOf(selectedCategory) % categoryTaglines.length]
        context.fillStyle = '#aeb3b8'
        context.font = `700 ${squareLayout ? 18 : 21}px Arial, sans-serif`
        context.fillText((headline.trim() || 'VITRINE DA SEMANA').toUpperCase(), 72, squareLayout ? 148 : 168)
        context.fillStyle = '#ffffff'
        let titleFontSize = squareLayout ? 46 : 60
        let titleLines: string[]
        do {
          context.font = `800 ${titleFontSize}px Arial, sans-serif`
          titleLines = wrapText(context, selectedCategory.toUpperCase(), width - 144)
          if (titleLines.length <= 2 || titleFontSize <= 36) break
          titleFontSize -= 2
        } while (true)
        let titleY = squareLayout ? 196 : 226
        const titleLineHeight = titleFontSize + 8
        titleLines.forEach((line) => { context.fillText(line, 72, titleY); titleY += titleLineHeight })
        context.fillStyle = accent
        context.fillRect(72, titleY + 2, squareLayout ? 180 : 240, 6)
        context.fillStyle = '#b7bcc1'
        context.font = `500 ${squareLayout ? 17 : 19}px Arial, sans-serif`
        context.fillText(tagline, 72, titleY + 36)

        const footerY = height - (normalizedCoupon ? 210 : 96)
        const gridTop = titleY + 64
        const gap = 24
        const columns = 2
        const rows = Math.ceil(categoryProducts.length / columns)
        const gridWidth = width - 144
        const cardWidth = (gridWidth - gap) / columns
        const cardHeight = Math.min(squareLayout ? 210 : 240, (footerY - gridTop - gap * (rows - 1)) / rows)

        categoryProducts.forEach((product, index) => {
          const column = index % columns
          const row = Math.floor(index / columns)
          const cardX = 72 + column * (cardWidth + gap)
          const cardY = gridTop + row * (cardHeight + gap)
          const cardAccent = categoryAccentColors[index % categoryAccentColors.length]

          context.fillStyle = '#111316'
          context.fillRect(cardX, cardY, cardWidth, cardHeight)
          context.strokeStyle = '#33373b'
          context.lineWidth = 2
          context.strokeRect(cardX, cardY, cardWidth, cardHeight)
          context.fillStyle = cardAccent
          context.fillRect(cardX, cardY, 6, cardHeight)

          const imageSize = cardHeight - 24
          const imageBoxX = cardX + 18
          const imageBoxY = cardY + 12
          const image = images[index]
          if (image) drawImageContain(context, image, imageBoxX, imageBoxY, imageSize, imageSize)
          else {
            context.fillStyle = '#73787e'
            context.font = '600 15px Arial, sans-serif'
            context.textAlign = 'center'
            context.fillText('FOTO', imageBoxX + imageSize / 2, imageBoxY + imageSize / 2)
            context.textAlign = 'left'
          }

          const textX = imageBoxX + imageSize + 20
          const textWidth = cardX + cardWidth - textX - 16
          context.fillStyle = '#ffffff'
          context.font = `800 ${squareLayout ? 17 : 19}px Arial, sans-serif`
          wrapText(context, product.name.toUpperCase(), textWidth).slice(0, 3).forEach((line, lineIndex) => context.fillText(line, textX, cardY + 30 + lineIndex * 24))

          const { original, final, hasAnyDiscount } = getCategoryPricing(product)
          const priceY = cardY + cardHeight - 22
          if (hasAnyDiscount && original > 0) {
            context.fillStyle = '#7f858b'
            context.font = '500 15px Arial, sans-serif'
            context.fillText(`de ${money(original)}`, textX, priceY - 22)
            context.fillStyle = '#f6c548'
            context.font = `800 ${squareLayout ? 20 : 22}px Arial, sans-serif`
            context.fillText(money(final), textX, priceY)
          } else {
            context.fillStyle = '#ffffff'
            context.font = `800 ${squareLayout ? 20 : 22}px Arial, sans-serif`
            context.fillText(original > 0 ? money(final) : 'CONSULTE', textX, priceY)
          }
        })

        if (normalizedCoupon) {
          context.fillStyle = matchedCoupon ? '#d83232' : '#555b61'
          context.fillRect(72, footerY, width - 144, couponUsageLimit ? 124 : 86)
          context.fillStyle = '#ffffff'
          context.font = '800 21px Arial, sans-serif'
          context.fillText(`UTILIZE O CUPOM  ${normalizedCoupon}`, 96, footerY + 32)
          context.font = '800 24px Arial, sans-serif'
          context.fillText(matchedCoupon ? (matchedCoupon.free_shipping ? 'E GANHE FRETE GRÁTIS. APROVEITE!' : `E GANHE ${couponDiscountPercent}% DE DESCONTO. APROVEITE!`) : 'CONFIRA AS CONDIÇÕES', 96, footerY + 64)
          if (couponUsageLimit) {
            context.font = '700 18px Arial, sans-serif'
            context.fillText(`VÁLIDO PARA OS PRIMEIROS ${couponUsageLimit} CLIENTES`, 96, footerY + 96)
          }
        }
        context.fillStyle = '#d83232'
        context.fillRect(72, height - 32, 120, 4)
        context.fillStyle = '#f6c548'
        context.font = '800 23px Arial, sans-serif'
        context.fillText('ACESSE www.lojaalphatec.com.br', 216, height - 18)
        setCanvasReady(true)
      })
      return
    }

    if (!selectedProduct) return

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
      let nameY = squareLayout ? 140 : 174
      context.fillStyle = '#ffffff'
      let nameFontSize = squareLayout ? 44 : 58
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
      const categoryY = nameY + (squareLayout ? 30 : 42)
      if (!squareLayout) context.fillText(category.toUpperCase(), nameX, categoryY)

      const footerY = squareLayout ? height - 188 : height - 190
      const imageY = squareLayout ? nameY + 20 : categoryY + 33
      const imageBox = { x: 42, y: imageY, width: width - 84, height: squareLayout ? Math.max(260, footerY - imageY - 64) : 470 }
      context.fillStyle = '#111316'
      context.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      context.strokeStyle = '#33373b'
      context.lineWidth = 2
      context.strokeRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height)
      const imagePadding = squareLayout ? 18 : 34
      const imageVerticalPadding = squareLayout ? 18 : 24
      if (image) drawImageContain(context, image, imageBox.x + imagePadding, imageBox.y + imageVerticalPadding, imageBox.width - imagePadding * 2, imageBox.height - imageVerticalPadding * 2)
      else {
        context.fillStyle = '#73787e'
        context.font = '600 24px Arial, sans-serif'
        context.textAlign = 'center'
        context.fillText('IMAGEM DO PRODUTO', width / 2, imageBox.y + imageBox.height / 2)
        context.textAlign = 'left'
      }

      if (!squareLayout) {
        const detailsHeadingY = imageBox.y + imageBox.height + 48
        const detailsTextY = detailsHeadingY + 35
        context.fillStyle = '#d53232'
        context.font = '800 21px Arial, sans-serif'
        context.fillText('ESPECIFICAÇÕES', 72, detailsHeadingY)
        const detailsWidth = width / 2 - 120
        const specificationText = selectedProduct.specifications || selectedProduct.description || 'Peça de qualidade para manter seu equipamento em movimento.'
        const detailsX = width / 2 + 24
        context.fillStyle = '#d53232'
        context.font = '800 21px Arial, sans-serif'
        context.fillText('PRINCIPAIS UTILIZAÇÕES', detailsX, detailsHeadingY)
        const usageText = selectedProduct.compatibleEquipment || selectedProduct.category || 'Equipamentos fitness'
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
  }, [mode, categoryProducts, categories, selectedCategory, coupon, couponBenefit, couponDiscountPercent, couponUsageLimit, format, headline, hasCouponDiscount, hasDiscount, originalPrice, normalizedCoupon, priceBeforeCoupon, promotionalPrice, selectedFormat, selectedProduct, discountPercent, matchedCoupon, showDiscount])

  function handleProductChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedId(event.target.value)
  }

  function downloadPost() {
    const canvas = canvasRef.current
    if (!canvas || !canvasReady) return onMessage('Aguarde a prévia do post terminar de carregar.')
    if (mode === 'category' && !selectedCategory) return onMessage('Selecione uma categoria para gerar o post.')
    if (mode === 'product' && !selectedProduct) return onMessage('Selecione um produto para gerar o post.')
    const fileNameSource = mode === 'category' ? selectedCategory : selectedProduct?.name || 'alpha-tec'
    try {
      const link = document.createElement('a')
      link.download = `post-${fileNameSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'alpha-tec'}.png`
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
          <div className="promotion-mode-toggle" role="tablist" aria-label="Tipo de post">
            <button type="button" className={mode === 'product' ? 'is-active' : ''} onClick={() => setMode('product')}>Produto único</button>
            <button type="button" className={mode === 'category' ? 'is-active' : ''} disabled={!categories.length} onClick={() => setMode('category')}>Por categoria</button>
          </div>
          {mode === 'product' ? (
            <label>Produto<select value={selectedProduct?.id || ''} onChange={handleProductChange}>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          ) : (
            <label>Categoria<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          )}
          <label>Chamada principal<input value={headline} maxLength={34} onChange={(event) => setHeadline(event.target.value)} placeholder={mode === 'category' ? 'VITRINE DA SEMANA' : 'OFERTA ESPECIAL'} /></label>
          <label>Cupom de desconto<input value={coupon} maxLength={20} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="EX.: ALPHA10" />{normalizedCoupon && <small className={`promotion-coupon-status ${matchedCoupon ? 'valid' : 'invalid'}`}>{matchedCoupon ? `Cupom válido: ${couponBenefit || 'benefício cadastrado'}` : 'Cupom não encontrado ou inativo'}</small>}</label>
          <label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as PostFormat)}>{formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.width} x {option.height})</option>)}</select></label>
          <label className="promotion-toggle"><input type="checkbox" checked={showDiscount} onChange={(event) => setShowDiscount(event.target.checked)} /> {mode === 'category' ? 'Mostrar descontos cadastrados nas peças da categoria' : `Mostrar desconto cadastrado${discountPercent > 0 ? ` (-${discountPercent}%)` : ' (este produto não tem desconto)'}`}</label>
          {mode === 'product' ? (
            <div className="promotion-product-summary"><span>Preço para o post</span><strong>{originalPrice > 0 ? money(promotionalPrice) : 'Consulte o preço'}</strong>{(hasDiscount || hasCouponDiscount) && <small>De {money(priceBeforeCoupon)} por {money(promotionalPrice)}{hasCouponDiscount ? ` com cupom -${couponDiscountPercent}%` : ''}</small>}</div>
          ) : (
            <>
              <fieldset className="category-checkbox-field promotion-product-picker">
                <legend>Peças da vitrine ({categoryProducts.length}/{maxCategoryProducts})</legend>
                {!categoryAvailableProducts.length && <p className="form-hint">Nenhuma peça ativa nessa categoria.</p>}
                <div className="promotion-product-picker-list">
                  {categoryAvailableProducts.map((product) => (
                    <label key={product.id}>
                      <input
                        type="checkbox"
                        checked={selectedCategoryProductIds.includes(product.id)}
                        onChange={() => toggleCategoryProduct(product.id)}
                      /> {product.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="promotion-product-summary"><span>Peças na vitrine</span><strong>{categoryProducts.length} de {categoryAvailableProducts.length} ativas</strong><small>Marque até {maxCategoryProducts} peças para compor o post.</small></div>
            </>
          )}
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

