import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const MAX_BYTES = 32 * 1024 * 1024

export async function sharePromotionMedia(payload: { fileName?: unknown; dataUrl?: unknown }) {
  if (typeof payload.fileName !== 'string' || typeof payload.dataUrl !== 'string') {
    throw new Error('Arquivo de exportação inválido.')
  }
  const match = /^data:(image\/png|video\/mp4|video\/webm)(?:;codecs=[^;,]+)?;base64,([A-Za-z0-9+/]+={0,2})$/.exec(payload.dataUrl)
  if (!match || match[2].length > Math.ceil(MAX_BYTES / 3) * 4) {
    throw new Error('Formato inválido ou arquivo maior que 32 MB. Reduza a duração do vídeo.')
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.')
  }
  const mimeType = match[1]
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'video/mp4' ? 'mp4' : 'webm'
  const name = payload.fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || 'alpha-tec'
  const file = new File(Paths.cache, `${name}-${Date.now()}.${extension}`)
  file.create()
  try {
    file.write(match[2], { encoding: 'base64' })
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Salvar ou compartilhar post Alpha Tec' })
  } catch (error) {
    if (file.exists) file.delete()
    throw error
  }
}
