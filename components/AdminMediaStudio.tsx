import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { exportPromotion } from '../lib/promotion-export'
import { getMediaPlacement, getVideoClip } from '../lib/promotion-video'
import { MAX_EXTRA_IMAGES } from '../lib/products'

type Product = { id: string; name: string; internalCode?: string; manufacturerPartNumber?: string; partType: string; displayOrder?: number; brand: string; category: string; compatibleEquipment: string; description: string; specifications: string; image: string; images?: string[]; price: number; active: boolean; stock: number; discountPercent: number; flashSale: boolean; showInBanner: boolean; showInFeatured: boolean; weightKg?: number; heightCm?: number; widthCm?: number; lengthCm?: number }
type Props = { products: Product[]; onSaved: (product: Product) => void; onMessage: (message: string) => void }
type MediaKind = 'image' | 'video'
type SaveTarget = 'gallery' | 'cover'

const CANVAS_SIZE = 1200
const MEDIA_BOX = { x: 150, y: 150, width: 900, height: 900 }
const DEFAULT_IMAGE_ZOOM = 1
const DEFAULT_VIDEO_ZOOM = 1.8
const BACKDROP_SRC = '/product-backdrop.jpg'
const AI_VIDEO_FPS = 12
const AI_VIDEO_MAX_SECONDS = 10

// A biblioteca de recorte é carregada via CDN em runtime: o bundle ONNX dela não é compatível
// com o empacotamento do Next/webpack, e os modelos de IA já são baixados de CDN de qualquer forma.
// O especificador 'onnxruntime-web' do bundle é resolvido pelo import map em pages/_document.tsx.
type BackgroundRemovalConfig = { device?: 'gpu' | 'cpu'; output?: { format?: 'image/png' | 'image/jpeg' | 'image/webp'; quality?: number }; progress?: (key: string, current: number, total: number) => void }
type BackgroundRemovalModule = { removeBackground: (source: Blob, config?: BackgroundRemovalConfig) => Promise<Blob> }
const BG_REMOVAL_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/index.mjs'
let backgroundRemovalPromise: Promise<BackgroundRemovalModule> | null = null
function loadBackgroundRemoval() {
  if (!backgroundRemovalPromise) {
    backgroundRemovalPromise = (import(/* webpackIgnore: true */ BG_REMOVAL_MODULE_URL) as Promise<BackgroundRemovalModule>).catch((error: unknown) => {
      backgroundRemovalPromise = null
      throw error
    })
  }
  return backgroundRemovalPromise
}

// Usa a GPU (WebGPU) quando disponível — essencial para processar vídeos quadro a quadro —
// e memoriza o modo que funcionou para as próximas execuções.
let aiDevice: 'gpu' | 'cpu' | null = null
async function removeBackgroundSmart(source: Blob, onProgress?: (key: string, current: number, total: number) => void): Promise<Blob> {
  const { removeBackground } = await loadBackgroundRemoval()
  const run = (device: 'gpu' | 'cpu') => removeBackground(source, { device, output: { format: 'image/png' }, progress: onProgress })
  if (aiDevice) return run(aiDevice)
  try {
    const result = await run('gpu')
    aiDevice = 'gpu'
    return result
  } catch {
    aiDevice = 'cpu'
    const result = await run('cpu')
    return result
  }
}

// Mesmo fundo técnico usado no vídeo de produto para o site (AdminPromotions).
function drawTechnicalFrame(context: CanvasRenderingContext2D) {
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  context.fillStyle = '#e8eaec'
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  context.fillStyle = '#d9dcdf'
  context.fillRect(0, 0, CANVAS_SIZE, 14)
  context.fillStyle = '#34383c'
  context.fillRect(0, CANVAS_SIZE - 18, CANVAS_SIZE, 18)
  context.fillStyle = '#8d2529'
  context.fillRect(CANVAS_SIZE - 22, 14, 8, 118)
  context.strokeStyle = 'rgba(52,56,60,.16)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(70, 80)
  context.lineTo(250, 80)
  context.moveTo(CANVAS_SIZE - 250, CANVAS_SIZE - 80)
  context.lineTo(CANVAS_SIZE - 70, CANVAS_SIZE - 80)
  context.stroke()
}

function drawMedia(context: CanvasRenderingContext2D, media: CanvasImageSource, sourceWidth: number, sourceHeight: number, zoom: number, offsetX: number, offsetY: number) {
  const placement = getMediaPlacement(sourceWidth, sourceHeight, MEDIA_BOX, true, zoom, offsetX, offsetY)
  context.save()
  context.beginPath()
  context.rect(MEDIA_BOX.x, MEDIA_BOX.y, MEDIA_BOX.width, MEDIA_BOX.height)
  context.clip()
  context.filter = 'drop-shadow(0px 24px 24px rgba(28,32,35,.22))'
  context.drawImage(media, placement.x, placement.y, placement.width, placement.height)
  context.filter = 'none'
  context.restore()
}

// Recorta o PNG com transparência para a caixa que realmente contém o produto,
// para que ele ocupe o quadro inteiro de composição (~75% da arte) como no padrão.
type AlphaBox = { x: number; y: number; width: number; height: number }

function measureAlphaBox(source: HTMLCanvasElement): AlphaBox | null {
  const context = source.getContext('2d')
  if (!context || !source.width || !source.height) return null
  const { data, width, height } = context.getImageData(0, 0, source.width, source.height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function padAlphaBox(box: AlphaBox, maxWidth: number, maxHeight: number): AlphaBox {
  const padding = Math.round(Math.max(box.width, box.height) * 0.02)
  const x = Math.max(0, box.x - padding)
  const y = Math.max(0, box.y - padding)
  return { x, y, width: Math.min(maxWidth, box.x + box.width + padding) - x, height: Math.min(maxHeight, box.y + box.height + padding) - y }
}

function unionAlphaBox(a: AlphaBox | null, b: AlphaBox | null): AlphaBox | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

function cropCanvas(source: HTMLCanvasElement, box: AlphaBox): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = box.width
  output.height = box.height
  output.getContext('2d')?.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
  return output
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível gerar o quadro.')), type, quality))
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.0005 && !video.seeking) return resolve()
    const finish = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('seeked', onSeeked)
    }
    const onSeeked = () => { finish(); resolve() }
    const timeout = window.setTimeout(() => { finish(); reject(new Error('Não foi possível posicionar o vídeo para processar o quadro.')) }, 10_000)
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

function cropToAlphaBounds(image: HTMLImageElement): HTMLCanvasElement | null {
  const source = document.createElement('canvas')
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const sourceContext = source.getContext('2d')
  if (!sourceContext || !source.width || !source.height) return null
  sourceContext.drawImage(image, 0, 0)
  const box = measureAlphaBox(source)
  if (!box) return source
  return cropCanvas(source, padAlphaBox(box, source.width, source.height))
}

// Composição com fundo padrão da marca: produto recortado pela IA sobre o backdrop técnico,
// com sombra de contato elíptica e sombra projetada suaves para um resultado natural.
function drawAiComposite(context: CanvasRenderingContext2D, backdrop: HTMLImageElement, cutout: CanvasImageSource, cutoutWidth: number, cutoutHeight: number, zoom: number, offsetX: number, offsetY: number, blend?: { cutout: CanvasImageSource; alpha: number }) {
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const scale = Math.max(CANVAS_SIZE / backdrop.naturalWidth, CANVAS_SIZE / backdrop.naturalHeight)
  const backdropWidth = backdrop.naturalWidth * scale
  const backdropHeight = backdrop.naturalHeight * scale
  context.drawImage(backdrop, (CANVAS_SIZE - backdropWidth) / 2, (CANVAS_SIZE - backdropHeight) / 2, backdropWidth, backdropHeight)
  const placement = getMediaPlacement(cutoutWidth, cutoutHeight, MEDIA_BOX, true, zoom, offsetX, offsetY)
  const centerX = placement.x + placement.width / 2
  const baseY = placement.y + placement.height - placement.height * 0.015
  context.save()
  context.filter = 'blur(18px)'
  context.fillStyle = 'rgba(28,32,35,.30)'
  context.beginPath()
  context.ellipse(centerX, baseY, placement.width * 0.44, Math.max(14, placement.width * 0.05), 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
  context.save()
  context.shadowColor = 'rgba(28,32,35,.20)'
  context.shadowBlur = 26
  context.shadowOffsetY = 14
  context.drawImage(cutout, placement.x, placement.y, placement.width, placement.height)
  context.restore()
  // Interpolação entre quadros consecutivos para suavizar o vídeo processado com IA.
  if (blend && blend.alpha > 0) {
    context.save()
    context.globalAlpha = Math.min(1, blend.alpha)
    context.drawImage(blend.cutout, placement.x, placement.y, placement.width, placement.height)
    context.restore()
  }
}

export default function AdminMediaStudio({ products, onSaved, onMessage }: Props) {
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_IMAGE_ZOOM)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [videoSpeed, setVideoSpeed] = useState(1)
  const [canvasReady, setCanvasReady] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [linkedProductId, setLinkedProductId] = useState('')
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('gallery')
  const [aiBackground, setAiBackground] = useState(true)
  const [backdrop, setBackdrop] = useState<HTMLImageElement | null>(null)
  const [cutoutUrl, setCutoutUrl] = useState('')
  const [cutoutImage, setCutoutImage] = useState<HTMLCanvasElement | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [removalStatus, setRemovalStatus] = useState('')
  const [aiFrames, setAiFrames] = useState<Blob[] | null>(null)
  const [aiFrameSize, setAiFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [aiProgress, setAiProgress] = useState('')
  const aiCancelRef = useRef(false)
  const aiPlaybackStartRef = useRef(0)
  const aiBitmapsRef = useRef<Map<number, ImageBitmap>>(new Map())
  const aiDecodingRef = useRef<Set<number>>(new Set())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingCleanupRef = useRef<(() => void) | null>(null)
  const clipDuration = Math.max(0, clipEnd - clipStart)
  const defaultZoom = mediaKind === 'video' ? DEFAULT_VIDEO_ZOOM : DEFAULT_IMAGE_ZOOM
  const baseName = (mediaFile?.name || 'produto').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto'
  const linkedProduct = products.find((product) => product.id === linkedProductId)
  const linkedGalleryCount = (linkedProduct?.images || []).length
  const busy = isRecording || isExporting || isSaving

  useEffect(() => () => recordingCleanupRef.current?.(), [])

  useEffect(() => {
    let cancelled = false
    const element = new Image()
    element.onload = () => { if (!cancelled) setBackdrop(element) }
    element.onerror = () => { if (!cancelled) onMessage('Não foi possível carregar o fundo técnico padrão. Recarregue a página para usar a troca de fundo com IA.') }
    element.src = BACKDROP_SRC
    return () => { cancelled = true }
  }, [onMessage])

  useEffect(() => {
    if (mediaKind !== 'image' || !mediaFile || !aiBackground || cutoutUrl) return
    let cancelled = false
    setIsRemovingBg(true)
    setRemovalStatus('Preparando a IA de recorte...')
    removeBackgroundSmart(mediaFile, (key, current, total) => {
      if (cancelled) return
      if (key.startsWith('fetch') && total > 0) setRemovalStatus(`Baixando o modelo de IA (${Math.round((current / total) * 100)}%)... só é necessário no primeiro uso.`)
      else setRemovalStatus('Recortando o produto da foto...')
    })
      .then((blob) => { if (!cancelled) setCutoutUrl(URL.createObjectURL(blob)) })
      .catch(() => {
        if (cancelled) return
        setAiBackground(false)
        onMessage('Não foi possível remover o fundo com IA neste dispositivo. A foto será enquadrada no padrão técnico sem troca de fundo.')
      })
      .finally(() => { if (!cancelled) { setIsRemovingBg(false); setRemovalStatus('') } })
    return () => { cancelled = true }
  }, [mediaKind, mediaFile, aiBackground, cutoutUrl, onMessage])

  useEffect(() => {
    if (!cutoutUrl) {
      setCutoutImage(null)
      return
    }
    let cancelled = false
    const element = new Image()
    element.onload = () => { if (!cancelled) setCutoutImage(cropToAlphaBounds(element)) }
    element.onerror = () => { if (!cancelled) { setCutoutImage(null); onMessage('Não foi possível abrir o recorte gerado pela IA. Tente novamente.') } }
    element.src = cutoutUrl
    return () => { cancelled = true }
  }, [cutoutUrl, onMessage])

  useEffect(() => () => { if (cutoutUrl) URL.revokeObjectURL(cutoutUrl) }, [cutoutUrl])

  // Quadros processados com IA valem para um arquivo e um corte específicos:
  // qualquer mudança invalida o resultado e cancela um processamento em andamento.
  useEffect(() => {
    setAiFrames(null)
    setAiFrameSize(null)
    aiBitmapsRef.current.forEach((bitmap) => bitmap.close())
    aiBitmapsRef.current.clear()
    aiDecodingRef.current.clear()
    return () => { aiCancelRef.current = true }
  }, [mediaUrl, clipStart, clipEnd])

  // A velocidade escolhida vale para a prévia e para a gravação do vídeo original.
  useEffect(() => {
    const video = videoRef.current
    if (video) video.playbackRate = videoSpeed
  }, [videoSpeed, mediaUrl, canvasReady])

  async function processAiVideo() {
    const video = videoRef.current
    if (!video || videoDuration <= 0) return onMessage('Aguarde o vídeo terminar de carregar.')
    let clip
    try {
      clip = getVideoClip(videoDuration, clipStart, clipEnd)
    } catch (error) {
      return onMessage(error instanceof Error ? error.message : 'Escolha um trecho válido do vídeo.')
    }
    if (clip.duration > AI_VIDEO_MAX_SECONDS) return onMessage(`Para a troca de fundo com IA, selecione um trecho de até ${AI_VIDEO_MAX_SECONDS} segundos.`)
    aiCancelRef.current = false
    setIsProcessingAi(true)
    setAiFrames(null)
    setAiFrameSize(null)
    try {
      setAiProgress('Preparando a IA de recorte...')
      await loadBackgroundRemoval()
      video.pause()
      const frameCount = Math.max(1, Math.round(clip.duration * AI_VIDEO_FPS))
      const grabScale = Math.min(1, 1024 / Math.max(video.videoWidth || 1, video.videoHeight || 1))
      const grab = document.createElement('canvas')
      grab.width = Math.max(1, Math.round((video.videoWidth || 1) * grabScale))
      grab.height = Math.max(1, Math.round((video.videoHeight || 1) * grabScale))
      const grabContext = grab.getContext('2d')
      if (!grabContext) throw new Error('Não foi possível preparar o processamento do vídeo.')
      grabContext.imageSmoothingQuality = 'high'
      const rawCutouts: Blob[] = []
      let box: AlphaBox | null = null
      for (let index = 0; index < frameCount; index++) {
        if (aiCancelRef.current) throw new Error('Processamento cancelado.')
        setAiProgress(`Recortando quadro ${index + 1} de ${frameCount}... mantenha esta tela aberta.`)
        await seekVideo(video, Math.min(clip.start + index / AI_VIDEO_FPS, clip.end - 0.001))
        grabContext.drawImage(video, 0, 0, grab.width, grab.height)
        const cutBlob = await removeBackgroundSmart(await canvasToBlob(grab, 'image/jpeg', 0.92))
        const cutCanvas = await blobToCanvas(cutBlob)
        box = unionAlphaBox(box, measureAlphaBox(cutCanvas))
        rawCutouts.push(cutBlob)
      }
      if (!box) throw new Error('A IA não encontrou o produto no vídeo. Tente outro trecho ou desligue a troca de fundo.')
      const paddedBox = padAlphaBox(box, grab.width, grab.height)
      const frames: Blob[] = []
      for (let index = 0; index < rawCutouts.length; index++) {
        if (aiCancelRef.current) throw new Error('Processamento cancelado.')
        setAiProgress(`Preparando quadro ${index + 1} de ${rawCutouts.length}...`)
        frames.push(await canvasToBlob(cropCanvas(await blobToCanvas(rawCutouts[index]), paddedBox), 'image/png'))
      }
      setAiFrames(frames)
      setAiFrameSize({ width: paddedBox.width, height: paddedBox.height })
      setZoom(DEFAULT_IMAGE_ZOOM)
      aiPlaybackStartRef.current = performance.now()
      onMessage(`Trecho processado com IA: ${frames.length} quadros prontos. Ajuste zoom e posição e gere o vídeo.`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Não foi possível processar o vídeo com IA neste dispositivo.')
    } finally {
      setIsProcessingAi(false)
      setAiProgress('')
    }
  }

  useEffect(() => {
    if (!mediaFile) {
      setMediaUrl('')
      return
    }
    const url = URL.createObjectURL(mediaFile)
    setMediaUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mediaFile])

  useEffect(() => {
    if (mediaKind !== 'image' || !mediaUrl) {
      setImage(null)
      return
    }
    let cancelled = false
    const element = new Image()
    element.onload = () => { if (!cancelled) setImage(element) }
    element.onerror = () => { if (!cancelled) { setImage(null); onMessage('Não foi possível abrir a imagem. Tente outro arquivo.') } }
    element.src = mediaUrl
    return () => { cancelled = true }
  }, [mediaKind, mediaUrl, onMessage])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingQuality = 'high'
    if (!mediaUrl || !mediaKind) {
      setCanvasReady(false)
      drawTechnicalFrame(context)
      context.fillStyle = '#858a90'
      context.font = '700 34px Arial, sans-serif'
      context.textAlign = 'center'
      context.fillText('ENVIE A FOTO OU O VÍDEO DA PEÇA', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      context.textAlign = 'left'
      return
    }
    if (mediaKind === 'image') {
      if (aiBackground) {
        if (!cutoutImage || !backdrop) {
          setCanvasReady(false)
          drawTechnicalFrame(context)
          context.fillStyle = '#858a90'
          context.font = '700 34px Arial, sans-serif'
          context.textAlign = 'center'
          context.fillText('REMOVENDO O FUNDO COM IA...', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
          context.textAlign = 'left'
          return
        }
        drawAiComposite(context, backdrop, cutoutImage, cutoutImage.width, cutoutImage.height, zoom, offsetX, offsetY)
        setCanvasReady(true)
        return
      }
      if (!image) { setCanvasReady(false); return }
      drawTechnicalFrame(context)
      drawMedia(context, image, image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY)
      setCanvasReady(true)
      return
    }
    let animationFrame = 0
    const aiMode = aiBackground && aiFrames && aiFrames.length > 0 && aiFrameSize && backdrop
    if (aiMode) videoRef.current?.pause()
    const circularDistance = (a: number, b: number, length: number) => {
      const difference = Math.abs(a - b)
      return Math.min(difference, length - difference)
    }
    const ensureAiBitmap = (frames: Blob[], index: number) => {
      const cache = aiBitmapsRef.current
      if (cache.has(index) || aiDecodingRef.current.has(index)) return
      aiDecodingRef.current.add(index)
      createImageBitmap(frames[index]).then((bitmap) => {
        aiDecodingRef.current.delete(index)
        cache.set(index, bitmap)
        cache.forEach((cached, key) => {
          if (circularDistance(key, index, frames.length) > 3) {
            cached.close()
            cache.delete(key)
          }
        })
      }).catch(() => aiDecodingRef.current.delete(index))
    }
    const drawFrame = () => {
      if (aiMode) {
        const frames = aiFrames
        const wallTotal = (frames.length / AI_VIDEO_FPS / videoSpeed) * 1000
        const elapsed = performance.now() - aiPlaybackStartRef.current
        const wallPosition = recordingCleanupRef.current ? Math.min(elapsed, wallTotal - 1) : elapsed % wallTotal
        const framePosition = (wallPosition / 1000) * videoSpeed * AI_VIDEO_FPS
        const firstIndex = Math.min(frames.length - 1, Math.max(0, Math.floor(framePosition)))
        const secondIndex = Math.min(frames.length - 1, firstIndex + 1)
        const blendAlpha = Math.min(1, Math.max(0, framePosition - firstIndex))
        ensureAiBitmap(frames, firstIndex)
        if (secondIndex !== firstIndex) ensureAiBitmap(frames, secondIndex)
        const first = aiBitmapsRef.current.get(firstIndex)
        const second = aiBitmapsRef.current.get(secondIndex)
        if (first) drawAiComposite(context, backdrop, first, aiFrameSize.width, aiFrameSize.height, zoom, offsetX, offsetY, second && secondIndex !== firstIndex ? { cutout: second, alpha: blendAlpha } : undefined)
        else drawTechnicalFrame(context)
        animationFrame = requestAnimationFrame(drawFrame)
        return
      }
      drawTechnicalFrame(context)
      const video = videoRef.current
      if (recordingCleanupRef.current && video && video.currentTime >= clipEnd) video.pause()
      if (!recordingCleanupRef.current && video && video.readyState >= 2 && clipDuration > 0 && (video.currentTime < clipStart || video.currentTime >= clipEnd)) {
        video.currentTime = clipStart
      }
      if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        drawMedia(context, video, video.videoWidth, video.videoHeight, zoom, offsetX, offsetY)
      }
      animationFrame = requestAnimationFrame(drawFrame)
    }
    drawFrame()
    return () => cancelAnimationFrame(animationFrame)
  }, [mediaUrl, mediaKind, image, zoom, offsetX, offsetY, clipStart, clipEnd, clipDuration, aiBackground, cutoutImage, backdrop, aiFrames, aiFrameSize, videoSpeed])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const kind: MediaKind | null = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
    if (!kind) {
      onMessage('Selecione uma foto ou um vídeo válido.')
      event.target.value = ''
      return
    }
    setCanvasReady(false)
    setMediaKind(kind)
    setMediaFile(file)
    setCutoutUrl('')
    setCutoutImage(null)
    setZoom(kind === 'video' ? DEFAULT_VIDEO_ZOOM : DEFAULT_IMAGE_ZOOM)
    setOffsetX(0)
    setOffsetY(0)
    setVideoDuration(0)
    setClipStart(0)
    setClipEnd(0)
    setVideoSpeed(1)
  }

  function resetAdjustments() {
    setZoom(defaultZoom)
    setOffsetX(0)
    setOffsetY(0)
    setClipStart(0)
    setClipEnd(videoDuration)
    setVideoSpeed(1)
  }

  async function saveMedia(blob: Blob, fileName: string) {
    setIsExporting(true)
    try {
      const result = await exportPromotion(blob, fileName)
      onMessage(result === 'shared' ? 'Compartilhamento aberto. Escolha um aplicativo para salvar ou enviar o arquivo.' : `Arquivo gerado em ${fileName.split('.').pop()?.toUpperCase()}. Confira os downloads.`)
    } finally {
      setIsExporting(false)
    }
  }

  async function exportImage() {
    const canvas = canvasRef.current
    if (!canvas || !canvasReady) return onMessage('Aguarde a prévia da imagem terminar de carregar.')
    try {
      setIsExporting(true)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png'))
      await saveMedia(blob, `produto-site-${baseName}.png`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PNG. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function exportVideo() {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !canvasReady || !video) return onMessage('Aguarde a prévia do vídeo terminar de carregar.')
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) return onMessage('Este navegador não permite gravar o vídeo. Tente no Chrome ou Edge atualizado.')

    const mimeTypes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) return onMessage('Este navegador não oferece um formato de vídeo compatível para gravação.')

    let cleanup: (() => void) | undefined
    const aiMode = Boolean(aiBackground && aiFrames && aiFrames.length > 0 && aiFrameSize)
    if (aiBackground && !aiMode) return onMessage('Processe o trecho com IA antes de gerar o vídeo, ou desligue a troca de fundo.')
    try {
      const duration = aiMode && aiFrames ? (aiFrames.length / AI_VIDEO_FPS / videoSpeed) * 1000 : (getVideoClip(videoDuration, clipStart, clipEnd).duration / videoSpeed) * 1000
      setIsRecording(true)
      video.pause()
      if (!aiMode && (video.seeking || Math.abs(video.currentTime - clipStart) > 0.001)) {
        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            window.clearTimeout(timeout)
            video.removeEventListener('seeked', seeked)
          }
          const seeked = () => { finish(); resolve() }
          const timeout = window.setTimeout(() => { finish(); reject(new Error('Não foi possível posicionar o vídeo no início do corte.')) }, 10_000)
          video.addEventListener('seeked', seeked)
          video.currentTime = clipStart
        })
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const stream = canvas.captureStream(30)
      // Bitrate alto para preservar a qualidade; reduzido em vídeos longos para caber no limite do app.
      const videoBitsPerSecond = duration <= 16_000 ? 14_000_000 : duration <= 32_000 ? 10_000_000 : 8_000_000
      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop())
        throw error
      }
      const chunks: BlobPart[] = []
      let progressTimer = 0
      let stopTimer = 0
      let failed = false
      const release = () => {
        window.clearInterval(progressTimer)
        window.clearTimeout(stopTimer)
        stream.getTracks().forEach((track) => track.stop())
        video.pause()
        recordingCleanupRef.current = null
      }
      cleanup = () => {
        failed = true
        if (recorder.state !== 'inactive') recorder.stop()
        release()
      }
      recordingCleanupRef.current = cleanup
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => {
        cleanup?.()
        setIsRecording(false)
        setRecordingProgress(0)
        onMessage('Não foi possível gravar o vídeo. Tente outro arquivo ou navegador.')
      }
      recorder.onstop = () => {
        release()
        if (failed) return
        setIsRecording(false)
        setRecordingProgress(0)
        const outputType = recorder.mimeType || mimeType
        const blob = new Blob(chunks, { type: outputType })
        const extension = outputType.includes('mp4') ? 'mp4' : 'webm'
        void saveMedia(blob, `produto-site-${baseName}.${extension}`).catch((error: unknown) => onMessage(error instanceof Error ? error.message : 'Não foi possível exportar o vídeo.'))
      }
      const begin = () => {
        if (failed || recorder.state !== 'recording') return
        window.clearTimeout(stopTimer)
        if (aiMode) aiPlaybackStartRef.current = performance.now()
        const startedAt = Date.now()
        progressTimer = window.setInterval(() => setRecordingProgress(Math.min(100, Math.round(((Date.now() - startedAt) / duration) * 100))), 250)
        stopTimer = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, duration)
      }
      recorder.onstart = () => {
        if (aiMode) {
          begin()
          return
        }
        void video.play().then(begin).catch(() => {
          cleanup?.()
          setIsRecording(false)
          setRecordingProgress(0)
          onMessage('Não foi possível reproduzir o vídeo para gravar o trecho selecionado.')
        })
      }
      stopTimer = window.setTimeout(() => {
        cleanup?.()
        setIsRecording(false)
        setRecordingProgress(0)
        onMessage('A gravação demorou demais para iniciar. Tente novamente ou use outro formato de vídeo.')
      }, 15_000)
      recorder.start(250)
    } catch (error) {
      cleanup?.()
      video.pause()
      setIsRecording(false)
      setRecordingProgress(0)
      onMessage(error instanceof Error ? error.message : 'Não foi possível iniciar a gravação. Verifique o vídeo enviado e tente novamente.')
    }
  }

  function handleExport() {
    if (busy) return
    if (isProcessingAi) return onMessage('Aguarde o processamento com IA terminar.')
    if (mediaKind === 'video') void exportVideo()
    else void exportImage()
  }

  async function saveToProduct() {
    const canvas = canvasRef.current
    if (busy) return
    if (mediaKind !== 'image') return onMessage('Somente fotos podem ser vinculadas ao produto. Para vídeos, gere o arquivo e use-o manualmente.')
    if (!canvas || !canvasReady) return onMessage('Aguarde a prévia da imagem terminar de carregar.')
    if (!linkedProduct) return onMessage('Selecione o produto que receberá a foto.')
    const gallery = linkedProduct.images || []
    if (saveTarget === 'gallery' && gallery.length >= MAX_EXTRA_IMAGES) return onMessage(`O produto já tem ${MAX_EXTRA_IMAGES} fotos adicionais. Remova uma na aba Produtos para adicionar outra.`)
    setIsSaving(true)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const payload = saveTarget === 'cover'
        ? { ...linkedProduct, image: dataUrl }
        : { ...linkedProduct, images: [...gallery, dataUrl].slice(0, MAX_EXTRA_IMAGES) }
      const response = await fetch('/api/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) return onMessage(result.error || 'Não foi possível salvar a foto no produto.')
      onSaved(result)
      onMessage(saveTarget === 'cover' ? `Foto principal de "${linkedProduct.name}" atualizada.` : `Foto adicionada à galeria de "${linkedProduct.name}".`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Não foi possível salvar a foto no produto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="promotion-studio">
      <div className="promotion-studio-header">
        <div>
          <p className="eyebrow">PADRÃO PARA E-COMMERCE</p>
          <h2>Editor de mídia de produto</h2>
          <p className="form-hint">Envie a foto ou o vídeo da peça e gere a mídia padronizada 1200×1200 para o cadastro: produto centralizado com proporções preservadas, fundo cinza técnico e sombra suave.</p>
        </div>
        <button className="primary-button" type="button" onClick={handleExport} disabled={!canvasReady || !mediaFile || busy || isProcessingAi}>
          {isExporting ? 'Exportando...' : isRecording ? `Gravando ${recordingProgress}%` : mediaKind === 'video' ? 'Gerar vídeo para cadastro' : 'Gerar imagem para cadastro'} <span>↓</span>
        </button>
      </div>

      <div className="promotion-studio-layout">
        <div className="promotion-controls">
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <h3>Configuração da mídia</h3>
            <label className="promotion-reel-file">Foto ou vídeo da peça<input type="file" accept="image/*,video/*" onChange={handleFileChange} /><small>{mediaFile ? mediaKind === 'video' ? `${mediaFile.name} · original ${videoDuration.toFixed(1)}s · trecho ${clipDuration.toFixed(1)}s` : mediaFile.name : 'Envie a foto ou o vídeo original da peça para padronizar antes do cadastro.'}</small></label>
            {mediaKind === 'image' && mediaFile && <>
              <label className="promotion-toggle"><input type="checkbox" checked={aiBackground} onChange={(event) => setAiBackground(event.target.checked)} /> Trocar fundo com IA (fundo técnico da marca)</label>
              <p className="form-hint">{isRemovingBg ? removalStatus || 'Recortando o produto da foto...' : aiBackground ? 'A IA recorta o produto e o coloca sobre o fundo padrão da marca (cinza técnico com detalhes em grafite e vermelho), com sombra suave. Tudo roda no seu dispositivo, sem custo por imagem.' : 'A foto original é apenas enquadrada no padrão técnico, sem troca de fundo.'}</p>
            </>}
            {mediaKind === 'video' && videoDuration > 0 && <>
              <label>Início do corte (segundos)<input type="number" min="0" max={Math.max(0, clipEnd - 0.1)} step="0.1" value={clipStart} onChange={(event) => setClipStart(Math.max(0, Math.min(Number(event.target.value), clipEnd - Math.min(0.1, videoDuration))))} /></label>
              <label>Fim do corte (segundos)<input type="number" min={clipStart + Math.min(0.1, videoDuration)} max={videoDuration} step="0.1" value={clipEnd} onChange={(event) => setClipEnd(Math.max(clipStart + Math.min(0.1, videoDuration), Math.min(Number(event.target.value), videoDuration)))} /></label>
              <label>Velocidade do vídeo<select value={videoSpeed} onChange={(event) => setVideoSpeed(Number(event.target.value))}>
                <option value={1}>Normal (1×)</option>
                <option value={0.75}>Lenta (0,75×)</option>
                <option value={0.5}>Câmera lenta (0,5×)</option>
                <option value={0.25}>Super lenta (0,25×)</option>
              </select></label>
              {videoSpeed !== 1 && <p className="form-hint">O vídeo final fica {videoSpeed < 1 ? 'mais longo' : 'mais curto'}: {(clipDuration / videoSpeed).toFixed(1)}s em vez de {clipDuration.toFixed(1)}s.</p>}
              <label className="promotion-toggle"><input type="checkbox" checked={aiBackground} onChange={(event) => setAiBackground(event.target.checked)} /> Trocar fundo com IA (fundo técnico da marca)</label>
              {aiBackground && <>
                <p className="form-hint">{isProcessingAi ? aiProgress : aiFrames ? `Trecho processado: ${aiFrames.length} quadros a ${AI_VIDEO_FPS} qps. Ajuste zoom e posição e gere o vídeo. Alterar o corte exige novo processamento.` : `A IA recorta o produto quadro a quadro (${AI_VIDEO_FPS} qps) e o coloca sobre o fundo padrão da marca com sombra suave. Use um trecho de até ${AI_VIDEO_MAX_SECONDS} segundos; o processamento pode levar alguns minutos e a tela deve ficar aberta.`}</p>
                {!aiFrames && !isProcessingAi && <button className="primary-button" type="button" onClick={() => void processAiVideo()}>Processar trecho com IA <span>→</span></button>}
                {isProcessingAi && <button type="button" onClick={() => { aiCancelRef.current = true }}>Cancelar processamento</button>}
              </>}
            </>}
            {mediaFile && <>
              <label className="promotion-site-zoom">Ampliação<input type="range" min="1" max="2.6" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><small>{zoom.toFixed(1)}× · proporções preservadas</small></label>
              <label>Posição horizontal<input type="range" min="-1" max="1" step="0.05" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
              <label>Posição vertical<input type="range" min="-1" max="1" step="0.05" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
              <button type="button" onClick={resetAdjustments}>Restaurar ajustes e centralizar</button>
            </>}
            {mediaKind === 'video' && <p className="form-hint">Exportação silenciosa do trecho selecionado, em tempo real. O arquivo pode incluir um breve quadro inicial enquanto o codificador é preparado. Mantenha esta tela aberta. No app, o arquivo final deve ter até 32 MB.</p>}
            {mediaKind === 'image' && mediaFile && <>
              <h3>Vincular ao produto</h3>
              <label>Produto cadastrado (opcional)<select value={linkedProductId} onChange={(event) => setLinkedProductId(event.target.value)}>
                <option value="">Somente baixar o arquivo</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.internalCode ? `${product.internalCode} · ` : ''}{product.name}</option>)}
              </select></label>
              {linkedProduct && <>
                <div className="promotion-mode-toggle" role="tablist" aria-label="Destino da foto no produto">
                  <button type="button" className={saveTarget === 'gallery' ? 'is-active' : ''} onClick={() => setSaveTarget('gallery')}>Adicionar à galeria</button>
                  <button type="button" className={saveTarget === 'cover' ? 'is-active' : ''} onClick={() => setSaveTarget('cover')}>Foto principal</button>
                </div>
                <p className="form-hint">{saveTarget === 'cover' ? 'A foto padronizada substitui a foto principal atual do produto.' : `A foto entra na galeria do produto (${linkedGalleryCount}/${MAX_EXTRA_IMAGES} fotos adicionais).`}</p>
                <button className="primary-button" type="button" onClick={() => void saveToProduct()} disabled={!canvasReady || busy}>{isSaving ? 'Salvando...' : 'Salvar foto no produto'} <span>→</span></button>
              </>}
            </>}
            <p className="form-hint">O arquivo gerado segue o mesmo padrão do vídeo de produto para o site. Use-o nas abas Produtos ou Cadastro ao registrar a peça.</p>
          </fieldset>
        </div>
        <div className="promotion-preview-panel">
          <div className="promotion-preview-toolbar"><span>{mediaKind === 'video' ? 'Prévia do vídeo de produto' : 'Prévia da imagem de produto'}</span><small>1200 x 1200px{mediaKind === 'video' && clipDuration > 0 ? ` · ${(clipDuration / videoSpeed).toFixed(1)}s${videoSpeed !== 1 ? ` · ${videoSpeed.toLocaleString('pt-BR')}×` : ''}` : ''}</small></div>
          <canvas ref={canvasRef} className="promotion-canvas is-site-video" aria-label="Prévia da mídia padronizada do produto" />
          {mediaKind === 'video' && mediaUrl && <video ref={videoRef} src={mediaUrl} className="promotion-source-video" muted playsInline loop={!isRecording} aria-hidden="true" onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration
            if (!Number.isFinite(duration) || duration <= 0) {
              setCanvasReady(false)
              onMessage('Não foi possível ler a duração do vídeo. Envie outro arquivo.')
              return
            }
            setVideoDuration(duration)
            setClipStart(0)
            setClipEnd(duration)
          }} onLoadedData={(event) => {
            if (Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0) setCanvasReady(true)
            void event.currentTarget.play().catch(() => onMessage('A prévia automática foi bloqueada. Toque em Gerar para iniciar a reprodução.'))
          }} onError={() => {
            setCanvasReady(false)
            onMessage('Não foi possível abrir o vídeo. Tente um arquivo MP4 compatível com seu aparelho.')
          }} />}
        </div>
      </div>
    </div>
  )
}
