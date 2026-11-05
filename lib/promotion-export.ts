declare global {
  interface Window {
    __alphaTecNativeExportVersion?: number
  }
}

export const MAX_NATIVE_EXPORT_BYTES = 32 * 1024 * 1024

export async function exportPromotion(blob: Blob, fileName: string): Promise<'download' | 'shared'> {
  if (!blob.size) throw new Error('O arquivo gerado está vazio. Tente gerar novamente.')
  if (window.ReactNativeWebView) {
    if (window.__alphaTecNativeExportVersion !== 1) {
      throw new Error('Atualize o aplicativo Alpha Tec para salvar e compartilhar posts e vídeos.')
    }
    if (blob.size > MAX_NATIVE_EXPORT_BYTES) {
      throw new Error('O arquivo ultrapassa 32 MB. Reduza a duração do vídeo e tente novamente.')
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível preparar o arquivo.'))
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo gerado.'))
      reader.readAsDataURL(blob)
    })
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timer)
        window.removeEventListener('alpha-tec-export-result', receive)
      }
      const receive = (event: Event) => {
        const detail: unknown = (event as CustomEvent<unknown>).detail
        if (!detail || typeof detail !== 'object' || !('id' in detail) || detail.id !== id) return
        cleanup()
        if ('error' in detail && typeof detail.error === 'string') reject(new Error(detail.error))
        else resolve()
      }
      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error('O app não confirmou a exportação. Tente novamente.'))
      }, 120_000)
      window.addEventListener('alpha-tec-export-result', receive)
      try {
        window.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'admin-export-media', id, fileName, dataUrl }))
      } catch (error) {
        cleanup()
        reject(error)
      }
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName
  link.href = url
  try {
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return 'download'
}
