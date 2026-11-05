export function getVideoClip(duration: number, start: number, end: number) {
  if (![duration, start, end].every(Number.isFinite) || duration <= 0 || start < 0 || end > duration || end <= start) {
    throw new Error('Escolha um trecho válido: o fim deve ser maior que o início e estar dentro da duração do vídeo.')
  }
  return { start, end, duration: end - start }
}

export function getMediaPlacement(sourceWidth: number, sourceHeight: number, box: { x: number; y: number; width: number; height: number }, contain: boolean, zoom: number, offsetX: number, offsetY: number) {
  const scale = (contain ? Math.min : Math.max)(box.width / sourceWidth, box.height / sourceHeight) * zoom
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return {
    x: box.x + (box.width - width) / 2 + offsetX * Math.abs(box.width - width) / 2,
    y: box.y + (box.height - height) / 2 + offsetY * Math.abs(box.height - height) / 2,
    width,
    height,
  }
}
