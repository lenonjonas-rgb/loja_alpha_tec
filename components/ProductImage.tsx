import { useState } from 'react'

export default function ProductImage({ src, name, eager = false }: { src?: string; name: string; eager?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)

  if (!src || failedSource === src) {
    return <span className="product-image-unavailable">Foto indisponível<span>Consulte nossa equipe sobre esta peça.</span></span>
  }

  return <img src={src} alt={name} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedSource(src)} />
}
