import type { NextApiRequest, NextApiResponse } from 'next'

type ShippingOption = { carrier: string; price: number; deadline: string }
type ResponseData = { options?: ShippingOption[]; error?: string }
export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const cep = String(req.query.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return res.status(400).json({ error: 'Informe um CEP válido.' })
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const address = await response.json()
    if (address.erro) return res.status(404).json({ error: 'CEP não encontrado.' })
    const state = String(address.uf || '').toUpperCase()
    const southStates = ['PR', 'RS', 'SC']
    const southeastStates = ['ES', 'MG', 'RJ', 'SP']
    const isSouth = southStates.includes(state)
    const isSoutheast = southeastStates.includes(state)
    const shippingIncreaseFactor = 1.65
    const applyShippingIncrease = (value: number) => Math.round(value * shippingIncreaseFactor * 100) / 100
    const correiosPrice = applyShippingIncrease(isSouth ? 24.9 : isSoutheast ? 29.9 : 39.9)
    const correiosDeadline = isSouth ? '3 a 5 dias úteis' : isSoutheast ? '4 a 7 dias úteis' : '5 a 10 dias úteis'
    const regionalOptions = isSouth
      ? [{ carrier: 'Expresso São Miguel', price: applyShippingIncrease(21.9), deadline: '2 a 4 dias úteis' }, { carrier: 'Rodonaves', price: applyShippingIncrease(26.9), deadline: '3 a 6 dias úteis' }]
      : isSoutheast
        ? [{ carrier: 'Rodonaves', price: applyShippingIncrease(26.9), deadline: '3 a 6 dias úteis' }, { carrier: 'Jamef', price: applyShippingIncrease(31.9), deadline: '4 a 7 dias úteis' }]
        : state === 'DF' || ['GO', 'MT', 'MS'].includes(state)
          ? [{ carrier: 'Rodonaves', price: applyShippingIncrease(34.9), deadline: '4 a 8 dias úteis' }, { carrier: 'Jamef', price: applyShippingIncrease(38.9), deadline: '5 a 9 dias úteis' }]
          : [{ carrier: 'Total Express', price: applyShippingIncrease(42.9), deadline: '6 a 11 dias úteis' }, { carrier: 'Jamef', price: applyShippingIncrease(47.9), deadline: '6 a 12 dias úteis' }]

    return res.status(200).json({ options: [{ carrier: 'Correios', price: correiosPrice, deadline: correiosDeadline }, ...regionalOptions] })
  } catch { return res.status(502).json({ error: 'Não foi possível calcular o frete agora.' }) }
}
