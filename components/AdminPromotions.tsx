import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getProductCategories, hasProductCategory } from '../lib/products'
import type { Product } from '../lib/products'

type Props = { products: Product[]; onMessage: (message: string) => void }
type PostFormat = 'portrait' | 'square'
type PostMode = 'product' | 'category'
type PromotionContent = 'feed' | 'reel'
type ReelSource = 'photo' | 'video'
type ReelDestination = 'instagram' | 'site'
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
  const [contentType, setContentType] = useState<PromotionContent>('feed')
  const [reelSource, setReelSource] = useState<ReelSource>('photo')
  const [reelDestination, setReelDestination] = useState<ReelDestination>('instagram')
  const [siteVideoZoom, setSiteVideoZoom] = useState(1.8)
  const [reelVideoFile, setReelVideoFile] = useState<File | null>(null)
  const [reelVideoUrl, setReelVideoUrl] = useState('')
  const [reelVideoDuration, setReelVideoDuration] = useState(0)
  const [reelHook, setReelHook] = useState('TREINO PARADO?')
  const [reelCta, setReelCta] = useState('ACESSE LOJAALPHATEC.COM.BR')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [canvasReady, setCanvasReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reelVideoRef = useRef<HTMLVideoElement>(null)
  const reelStartTimeRef = useRef(0)
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
    if (contentType === 'reel') {
      if (!selectedProduct) return ''
      const lines = [`${reelHook.trim().toUpperCase() || 'TREINO PARADO?'}`, '', `Conheça ${selectedProduct.name} e mantenha seu equipamento pronto para o treino.`]
      if (hasDiscount) lines.push('', `Oferta: de ${money(originalPrice)} por ${money(priceBeforeCoupon)}.`)
      else if (hasCouponDiscount) lines.push('', `Oferta: ${money(promotionalPrice)} usando o cupom ${normalizedCoupon}.`)
      else if (originalPrice > 0) lines.push('', `Garanta por ${money(promotionalPrice)}.`)
      if (matchedCoupon) {
        if (matchedCoupon.free_shipping) lines.push(`Use ${normalizedCoupon} e ganhe frete grátis.`)
        else if (couponDiscountPercent > 0 && !hasCouponDiscount) lines.push(`Use ${normalizedCoupon} e ganhe ${couponDiscountPercent}% de desconto.`)
        if (couponUsageLimit) lines.push(`Válido para os primeiros ${couponUsageLimit} clientes.`)
      }
      lines.push('', `${reelCta.trim() || 'ACESSE LOJAALPHATEC.COM.BR'}.`, 'Peça também pelo Direct.', '', '#AlphaTec #PecasFitness #Academia #EquipamentosFitness')
      return lines.join('\n')
    }
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
  }, [contentType, reelHook, reelCta, mode, selectedCategory, categoryProducts, categories, couponDiscountPercent, couponUsageLimit, discountPercent, hasCouponDiscount, hasDiscount, headline, matchedCoupon, normalizedCoupon, originalPrice, priceBeforeCoupon, promotionalPrice, selectedProduct, showDiscount])

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
    if (!reelVideoFile) {
      setReelVideoUrl('')
      return
    }
    const url = URL.createObjectURL(reelVideoFile)
    setReelVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [reelVideoFile])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (mode === 'category' && !categoryProducts.length) return
    if (mode === 'product' && !selectedProduct) return
    if (contentType === 'reel') {
      const width = 1080
      const height = 1920
      const siteOutput = reelDestination === 'site'
      const reelDuration = siteOutput && reelVideoDuration > 0 ? reelVideoDuration * 1000 : 12_000
      const canvasWidth = siteOutput ? 1200 : width
      const canvasHeight = siteOutput ? 1200 : height
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      setCanvasReady(false)
      const context = canvas.getContext('2d')
      if (!context || !selectedProduct) return
      let animationFrame = 0
      let ready = false
      let productImage: HTMLImageElement | undefined
      reelStartTimeRef.current = performance.now()

      if (reelSource === 'photo' && selectedProduct.image) {
        productImage = new Image()
        productImage.crossOrigin = 'anonymous'
        productImage.onload = () => { if (!ready) { ready = true; setCanvasReady(true) } }
        productImage.onerror = () => { if (!ready) { ready = true; setCanvasReady(true) } }
        productImage.src = selectedProduct.image
      } else {
        ready = true
        setCanvasReady(true)
      }

      const drawFrame = () => {
        context.clearRect(0, 0, canvasWidth, canvasHeight)
        if (siteOutput) {
          context.fillStyle = '#e8eaec'
          context.fillRect(0, 0, canvasWidth, canvasHeight)
          context.fillStyle = '#d9dcdf'
          context.fillRect(0, 0, canvasWidth, 14)
          context.fillStyle = '#34383c'
          context.fillRect(0, canvasHeight - 18, canvasWidth, 18)
          context.fillStyle = '#8d2529'
          context.fillRect(canvasWidth - 22, 14, 8, 118)
          context.strokeStyle = 'rgba(52,56,60,.16)'
          context.lineWidth = 2
          context.beginPath()
          context.moveTo(70, 80)
          context.lineTo(250, 80)
          context.moveTo(canvasWidth - 250, canvasHeight - 80)
          context.lineTo(canvasWidth - 70, canvasHeight - 80)
          context.stroke()
        } else {
          context.fillStyle = '#090a0c'
          context.fillRect(0, 0, canvasWidth, canvasHeight)
        }
        const elapsed = (performance.now() - reelStartTimeRef.current) % reelDuration
        const mediaBox = siteOutput
          ? { x: 150, y: 150, width: 900, height: 900 }
          : { x: 54, y: 570, width: width - 108, height: 900 }
        const video = reelVideoRef.current
        const media = reelSource === 'video' && video && video.readyState >= 2 ? video : productImage
        if (media) {
          const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
          const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
          if (sourceWidth && sourceHeight) {
            const fitScale = siteOutput
              ? Math.min(mediaBox.width / sourceWidth, mediaBox.height / sourceHeight)
              : Math.max(mediaBox.width / sourceWidth, mediaBox.height / sourceHeight)
            const scale = fitScale * (siteOutput ? siteVideoZoom : 1)
            const drawWidth = sourceWidth * scale
            const drawHeight = sourceHeight * scale
            context.save()
            context.beginPath()
            context.rect(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height)
            context.clip()
            if (siteOutput) {
              context.filter = 'drop-shadow(0px 24px 24px rgba(28,32,35,.22))'
              context.drawImage(media, mediaBox.x + (mediaBox.width - drawWidth) / 2, mediaBox.y + (mediaBox.height - drawHeight) / 2, drawWidth, drawHeight)
              context.filter = 'none'
            } else if (reelSource === 'photo') {
              const facing = Math.cos((elapsed / 6000) * Math.PI * 2)
              const horizontalScale = Math.sign(facing || 1) * Math.max(.08, Math.abs(facing))
              context.translate(mediaBox.x + mediaBox.width / 2, mediaBox.y + mediaBox.height / 2)
              context.scale(horizontalScale, 1)
              context.drawImage(media, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
            } else {
              context.drawImage(media, mediaBox.x + (mediaBox.width - drawWidth) / 2, mediaBox.y + (mediaBox.height - drawHeight) / 2, drawWidth, drawHeight)
            }
            context.restore()
          }
        } else {
          context.fillStyle = '#17191c'
          context.fillRect(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height)
          context.fillStyle = '#858a90'
          context.font = '700 30px Arial, sans-serif'
          context.textAlign = 'center'
          context.fillText('PRÉVIA DO PRODUTO', width / 2, mediaBox.y + mediaBox.height / 2)
          context.textAlign = 'left'
        }

        if (!siteOutput) {
          const overlay = context.createLinearGradient(0, 260, 0, height)
          overlay.addColorStop(0, 'rgba(9,10,12,.96)')
          overlay.addColorStop(.18, 'rgba(9,10,12,.08)')
          overlay.addColorStop(.58, 'rgba(9,10,12,.12)')
          overlay.addColorStop(1, 'rgba(9,10,12,.98)')
          context.fillStyle = overlay
          context.fillRect(0, 0, width, height)
          context.fillStyle = '#d83232'
          context.fillRect(0, 0, width, 18)
          context.fillStyle = '#ffffff'
          context.font = '800 42px Arial, sans-serif'
          context.fillText('ALPHA TEC', 72, 112)
          context.fillStyle = '#aeb3b8'
          context.font = '700 23px Arial, sans-serif'
          context.fillText('PEÇAS E ACESSÓRIOS FITNESS', 72, 151)

          context.fillStyle = 'rgba(9,10,12,.84)'
          context.fillRect(54, 205, width - 108, 320)
          context.fillStyle = '#f6c548'
          context.font = '800 31px Arial, sans-serif'
          context.fillText((headline.trim() || 'OFERTA ESPECIAL').toUpperCase(), 72, 265)
          context.fillStyle = '#ffffff'
          context.font = '800 70px Arial, sans-serif'
          wrapText(context, reelHook.trim().toUpperCase() || 'TREINO PARADO?', width - 144).slice(0, 2).forEach((line, index) => context.fillText(line, 72, 350 + index * 78))
          context.fillStyle = '#d4d7da'
          context.font = '700 36px Arial, sans-serif'
          wrapText(context, selectedProduct.name.toUpperCase(), width - 144).slice(0, 2).forEach((line, index) => context.fillText(line, 72, 470 + index * 45))

          context.fillStyle = 'rgba(9,10,12,.9)'
          context.fillRect(54, 1490, width - 108, 300)
          context.fillStyle = '#f6c548'
          context.font = '800 58px Arial, sans-serif'
          context.fillText(originalPrice > 0 ? money(promotionalPrice) : 'CONSULTE O PREÇO', 72, 1575)
          if (hasDiscount || hasCouponDiscount) {
            context.fillStyle = '#c5c9cd'
            context.font = '500 28px Arial, sans-serif'
            context.fillText(`De ${money(priceBeforeCoupon)}`, 72, 1620)
          }
          if (matchedCoupon) {
            context.fillStyle = '#ffffff'
            context.font = '700 27px Arial, sans-serif'
            context.fillText(`CUPOM ${normalizedCoupon}`, 72, 1665)
          }
          context.fillStyle = '#ffffff'
          context.font = '800 34px Arial, sans-serif'
          wrapText(context, reelCta.trim().toUpperCase() || 'ACESSE LOJAALPHATEC.COM.BR', width - 144).slice(0, 1).forEach((line) => context.fillText(line, 72, 1720))
          context.fillStyle = '#f6c548'
          context.font = '700 25px Arial, sans-serif'
          context.fillText('OU CHAME NO DIRECT', 72, 1765)

          context.fillStyle = '#d83232'
          context.fillRect(72, height - 78, 140, 6)
          context.fillStyle = '#ffffff'
          context.font = '700 28px Arial, sans-serif'
          context.fillText('www.lojaalphatec.com.br', 72, height - 30)
        }
        animationFrame = requestAnimationFrame(drawFrame)
      }

      drawFrame()
      return () => cancelAnimationFrame(animationFrame)
    }
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
  }, [contentType, reelSource, reelDestination, siteVideoZoom, reelVideoUrl, reelVideoDuration, reelHook, reelCta, mode, categoryProducts, categories, selectedCategory, coupon, couponBenefit, couponDiscountPercent, couponUsageLimit, format, headline, hasCouponDiscount, hasDiscount, originalPrice, normalizedCoupon, priceBeforeCoupon, promotionalPrice, selectedFormat, selectedProduct, discountPercent, matchedCoupon, showDiscount])

  function handleProductChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedId(event.target.value)
  }

  function downloadPost() {
    if (contentType === 'reel') {
      void downloadReel()
      return
    }
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

  async function downloadReel() {
    const canvas = canvasRef.current
    if (!canvas || !canvasReady) return onMessage('Aguarde a prévia do Reel terminar de carregar.')
    if (reelSource === 'video' && !reelVideoFile) return onMessage('Envie o vídeo da peça para continuar.')
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) return onMessage('Este navegador não permite gravar o Reel. Tente no Chrome ou Edge atualizado.')

    const mimeTypes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) return onMessage('Este navegador não oferece um formato de vídeo compatível para gravação.')

    const video = reelSource === 'video' ? reelVideoRef.current : null
    try {
      if (video) {
        video.currentTime = 0
        await video.play()
      }
      reelStartTimeRef.current = performance.now()
      const stream = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
      const chunks: BlobPart[] = []
      const siteOutput = reelDestination === 'site'
      const duration = siteOutput && video && Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration * 1000) : 12_000
      let progressTimer = 0
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (video) video.pause()
        setIsRecording(false)
        setRecordingProgress(0)
        onMessage('Não foi possível gravar o vídeo. Tente outro arquivo ou navegador.')
      }
      recorder.onstop = () => {
        window.clearInterval(progressTimer)
        stream.getTracks().forEach((track) => track.stop())
        if (video) video.pause()
        setIsRecording(false)
        setRecordingProgress(0)
        const outputType = recorder.mimeType || mimeType
        const blob = new Blob(chunks, { type: outputType })
        const extension = outputType.includes('mp4') ? 'mp4' : 'webm'
        const filePrefix = siteOutput ? 'produto-site' : 'reel'
        const fileName = `${filePrefix}-${(selectedProduct?.name || 'alpha-tec').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${extension}`
        const link = document.createElement('a')
        link.download = fileName
        link.href = URL.createObjectURL(blob)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
        onMessage(siteOutput ? `Vídeo para site gerado em ${extension.toUpperCase()}.` : extension === 'mp4' ? 'Reel gerado e baixado em MP4.' : 'Reel gerado em WebM. Para publicar no Instagram, converta o arquivo para MP4.')
      }
      recorder.start(250)
      setIsRecording(true)
      const startedAt = Date.now()
      progressTimer = window.setInterval(() => setRecordingProgress(Math.min(100, Math.round(((Date.now() - startedAt) / duration) * 100))), 250)
      window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, duration)
    } catch {
      if (video) video.pause()
      setIsRecording(false)
      setRecordingProgress(0)
      onMessage('Não foi possível iniciar a gravação. Verifique o vídeo enviado e tente novamente.')
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
          <p className="eyebrow">{contentType === 'reel' && reelDestination === 'site' ? 'PADRÃO PARA E-COMMERCE' : 'CONTEÚDO PARA INSTAGRAM'}</p>
          <h2>Posts promocionais</h2>
          <p className="form-hint">{contentType === 'reel' && reelDestination === 'site' ? 'Ajuste o enquadramento e gere um vídeo quadrado para a página do produto.' : 'Escolha uma peça, destaque o preço e crie uma arte pronta para publicar.'}</p>
        </div>
        <button className="primary-button" type="button" onClick={downloadPost} disabled={isRecording || (contentType === 'reel' && reelSource === 'video' && !reelVideoFile)}>{isRecording ? `Gravando ${recordingProgress}%` : contentType === 'reel' ? reelDestination === 'site' ? 'Gerar vídeo para site' : 'Gerar Reel' : 'Gerar post para Instagram'} <span>↓</span></button>
      </div>

      {!activeProducts.length ? <p className="form-hint">Cadastre pelo menos um produto ativo para criar um post.</p> : <div className="promotion-studio-layout">
        <div className="promotion-controls">
          <h3>Configuração da oferta</h3>
          <div className="promotion-mode-toggle" role="tablist" aria-label="Formato do conteúdo">
            <button type="button" className={contentType === 'feed' ? 'is-active' : ''} onClick={() => setContentType('feed')}>Arte para feed</button>
            <button type="button" className={contentType === 'reel' ? 'is-active' : ''} onClick={() => { setContentType('reel'); setMode('product') }}>Reel de produto</button>
          </div>
          {contentType === 'reel' && <>
            <div className="promotion-mode-toggle" role="tablist" aria-label="Destino do vídeo">
              <button type="button" className={reelDestination === 'instagram' ? 'is-active' : ''} onClick={() => { setReelDestination('instagram'); setReelSource('photo') }}>Reel Instagram</button>
              <button type="button" className={reelDestination === 'site' ? 'is-active' : ''} onClick={() => { setReelDestination('site'); setReelSource('video') }}>Editar para site</button>
            </div>
            {reelDestination === 'instagram' && <div className="promotion-mode-toggle" role="tablist" aria-label="Origem do vídeo">
              <button type="button" className={reelSource === 'photo' ? 'is-active' : ''} onClick={() => setReelSource('photo')}>Animar foto</button>
              <button type="button" className={reelSource === 'video' ? 'is-active' : ''} onClick={() => setReelSource('video')}>Vídeo 360°</button>
            </div>}
            {reelSource === 'video' && <label className="promotion-reel-file">Vídeo da peça<input type="file" accept="video/*" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file && !file.type.startsWith('video/')) {
                onMessage('Selecione um arquivo de vídeo válido.')
                event.target.value = ''
                return
              }
              setReelVideoFile(file || null)
            }} /><small>{reelVideoFile ? `${reelVideoFile.name} · ${reelDestination === 'site' ? `${reelVideoDuration.toFixed(1)}s · saída quadrada` : 'será usado em um Reel de 12 segundos'}` : reelDestination === 'site' ? 'Envie o vídeo do produto para aplicar o padrão de e-commerce.' : 'Envie um vídeo curto da peça girando em 360°.'}</small></label>}
            {reelDestination === 'instagram' && <>
              <label>Gancho inicial<input value={reelHook} maxLength={42} onChange={(event) => setReelHook(event.target.value)} placeholder="Ex.: TREINO PARADO?" /></label>
              <label>Chamada para ação<input value={reelCta} maxLength={48} onChange={(event) => setReelCta(event.target.value)} placeholder="Ex.: ACESSE LOJAALPHATEC.COM.BR" /></label>
              <p className="form-hint">Na opção de foto, a imagem gira durante todo o Reel. Para mostrar a rotação real da peça, envie um vídeo 360°. A gravação é silenciosa; adicione música pelo Instagram.</p>
            </>}
            {reelDestination === 'site' && <>
              <label className="promotion-site-zoom">Enquadramento da peça<input type="range" min="1" max="2.6" step="0.1" value={siteVideoZoom} onChange={(event) => setSiteVideoZoom(Number(event.target.value))} /><small>Ampliação de {siteVideoZoom.toFixed(1)}×; ajuste para preencher melhor o quadro sem cortar a peça.</small></label>
              <p className="form-hint">Saída quadrada 1200×1200, produto centralizado com proporções preservadas, fundo cinza técnico e sombra suave. O vídeo original continua visível dentro da área do produto.</p>
            </>}
          </>}
          <div className="promotion-mode-toggle" role="tablist" aria-label="Tipo de post">
            <button type="button" className={mode === 'product' ? 'is-active' : ''} onClick={() => setMode('product')}>Produto único</button>
            <button type="button" className={mode === 'category' ? 'is-active' : ''} disabled={!categories.length || contentType === 'reel'} onClick={() => setMode('category')}>Por categoria</button>
          </div>
          {mode === 'product' ? (
            <label>Produto<select value={selectedProduct?.id || ''} onChange={handleProductChange}>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          ) : (
            <label>Categoria<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          )}
          {!(contentType === 'reel' && reelDestination === 'site') && <>
            <label>Chamada principal<input value={headline} maxLength={34} onChange={(event) => setHeadline(event.target.value)} placeholder={mode === 'category' ? 'VITRINE DA SEMANA' : 'OFERTA ESPECIAL'} /></label>
            <label>Cupom de desconto<input value={coupon} maxLength={20} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="EX.: ALPHA10" />{normalizedCoupon && <small className={`promotion-coupon-status ${matchedCoupon ? 'valid' : 'invalid'}`}>{matchedCoupon ? `Cupom válido: ${couponBenefit || 'benefício cadastrado'}` : 'Cupom não encontrado ou inativo'}</small>}</label>
          </>}
          {contentType === 'feed' && <label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as PostFormat)}>{formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.width} x {option.height})</option>)}</select></label>}
          {!(contentType === 'reel' && reelDestination === 'site') && <label className="promotion-toggle"><input type="checkbox" checked={showDiscount} onChange={(event) => setShowDiscount(event.target.checked)} /> {mode === 'category' ? 'Mostrar descontos cadastrados nas peças da categoria' : `Mostrar desconto cadastrado${discountPercent > 0 ? ` (-${discountPercent}%)` : ' (este produto não tem desconto)'}`}</label>}
          {contentType === 'reel' && reelDestination === 'site' ? null : mode === 'product' ? (
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
          {!(contentType === 'reel' && reelDestination === 'site') && <p className="form-hint">A porcentagem exibida vem do cupom salvo na aba Cupons. O post não aceita valores inventados e identifica quando o código ainda não existe.</p>}

        </div>
        <div className="promotion-preview-panel">
          <div className="promotion-preview-toolbar"><span>{contentType === 'reel' ? reelDestination === 'site' ? 'Prévia do vídeo de produto' : 'Prévia do Reel' : 'Prévia do post'}</span><small>{contentType === 'reel' ? reelDestination === 'site' ? `1200 x 1200px · ${reelVideoDuration.toFixed(1)}s` : '1080 x 1920px · 12s' : `${selectedFormat.width} x ${selectedFormat.height}px`}</small></div>
          <canvas ref={canvasRef} className={`promotion-canvas${contentType === 'reel' ? reelDestination === 'site' ? ' is-site-video' : ' is-reel' : ''}`} aria-label={contentType === 'reel' ? reelDestination === 'site' ? 'Prévia do vídeo de produto para site' : 'Prévia do Reel promocional' : 'Prévia do post promocional'} />
          {contentType === 'reel' && reelSource === 'video' && reelVideoUrl && <video ref={reelVideoRef} src={reelVideoUrl} className="promotion-source-video" muted playsInline loop={reelDestination !== 'site'} aria-hidden="true" onLoadedMetadata={(event) => setReelVideoDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onLoadedData={(event) => event.currentTarget.play().catch(() => undefined)} />}
          {!(contentType === 'reel' && reelDestination === 'site') && <div className="promotion-caption-panel">
            <div className="promotion-preview-toolbar"><span>{contentType === 'reel' ? 'Legenda para o Reel' : 'Legenda para Instagram'}</span><button type="button" onClick={() => void copyCaption()}>Copiar legenda</button></div>
            <textarea value={caption} onChange={() => undefined} readOnly aria-label="Legenda gerada para Instagram" />
          </div>}
        </div>
      </div>}
    </div>
  )
}

