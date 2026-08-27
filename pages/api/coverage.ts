import type { NextApiRequest, NextApiResponse } from 'next'
import { storeConfig } from '../../lib/store-config'

type ResponseData = { distanceKm?: number; withinRadius?: boolean; error?: string }

function distanceInKm(latitude: number, longitude: number) {
  const earthRadius = 6371
  const latDelta = (latitude - storeConfig.location.latitude) * Math.PI / 180
  const lonDelta = (longitude - storeConfig.location.longitude) * Math.PI / 180
  const storeLat = storeConfig.location.latitude * Math.PI / 180
  const customerLat = latitude * Math.PI / 180
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(storeLat) * Math.cos(customerLat) * Math.sin(lonDelta / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const cep = String(req.query.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return res.status(400).json({ error: 'Informe um CEP válido.' })

  try {
    const addressResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const address = await addressResponse.json()
    if (address.erro) return res.status(404).json({ error: 'CEP não encontrado.' })

    const queries = [
      `${address.logradouro || ''}, ${address.localidade}, ${address.uf}, Brazil`,
      `${address.localidade}, ${address.uf}, Brazil`,
      `${address.cep}, ${address.localidade}, ${address.uf}, Brazil`,
    ]
    let place: { lat: string; lon: string } | undefined
    for (const candidate of queries) {
      const query = encodeURIComponent(candidate)
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${query}`, { headers: { 'User-Agent': 'AlphaTec/1.0' } })
      const places = await geoResponse.json()
      if (places[0]) { place = places[0]; break }
    }
    if (!place) return res.status(422).json({ error: 'CEP válido, mas não foi possível calcular a distância deste endereço agora. Tente novamente.' })

    const distanceKm = Number(distanceInKm(Number(place.lat), Number(place.lon)).toFixed(1))
    return res.status(200).json({ distanceKm, withinRadius: distanceKm <= storeConfig.serviceRadiusKm })
  } catch {
    return res.status(502).json({ error: 'Não foi possível analisar a área de atendimento agora.' })
  }
}
