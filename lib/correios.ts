import { storeConfig } from './store-config'

type CorreiosConfig = {
  baseUrl: string
  usuario: string
  codigoAcesso: string
  cartaoPostagem: string
  contrato: string
  codigoServico: string
}

export type CorreiosDestination = { name?: string; document?: string; phone?: string; cep?: string; address?: string; number?: string; complement?: string; neighborhood?: string; city?: string }
export type CorreiosPackage = { weightGrams: number; heightCm: number; widthCm: number; lengthCm: number }
export type CorreiosContentItem = { conteudo: string; quantidade: string; valor: string }

export function getCorreiosConfig(): CorreiosConfig | null {
  const usuario = process.env.CORREIOS_USUARIO
  const codigoAcesso = process.env.CORREIOS_CODIGO_ACESSO
  const cartaoPostagem = process.env.CORREIOS_CARTAO_POSTAGEM
  const contrato = process.env.CORREIOS_CONTRATO
  if (!usuario || !codigoAcesso || !cartaoPostagem || !contrato) return null

  return {
    baseUrl: process.env.CORREIOS_AMBIENTE === 'homologacao' ? 'https://apihom.correios.com.br' : 'https://api.correios.com.br',
    usuario,
    codigoAcesso,
    cartaoPostagem,
    contrato,
    codigoServico: process.env.CORREIOS_CODIGO_SERVICO || '03298',
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getCorreiosToken(config: CorreiosConfig) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  const basic = Buffer.from(`${config.usuario}:${config.codigoAcesso}`).toString('base64')
  const response = await fetch(`${config.baseUrl}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
    body: JSON.stringify({ numero: config.cartaoPostagem }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.token) {
    throw new Error(describeCorreiosError(data) || 'Não foi possível autenticar nos Correios. Confira usuário, código de acesso e cartão de postagem.')
  }

  const expiresAt = data.expiraEm ? new Date(data.expiraEm).getTime() : Date.now() + 20 * 60 * 1000
  cachedToken = { token: data.token, expiresAt }
  return data.token as string
}

function onlyDigits(value: string | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function splitPhone(phone: string | undefined) {
  const digits = onlyDigits(phone)
  return digits.length > 10 ? { ddd: digits.slice(0, 2), numero: digits.slice(2) } : { ddd: digits.slice(0, 2), numero: digits.slice(2) }
}

function splitCityState(city: string | undefined) {
  const [name, state] = String(city || '').split('/')
  return { cidade: (name || '').trim(), uf: (state || '').trim().toUpperCase() }
}

export async function createPrepostagem(params: {
  destination: CorreiosDestination
  destinationEmail?: string
  pkg: CorreiosPackage
  items: CorreiosContentItem[]
  orderReference: string
  invoiceKey?: string
}) {
  const config = getCorreiosConfig()
  if (!config) throw new Error('Integração dos Correios não configurada. Defina CORREIOS_USUARIO, CORREIOS_CODIGO_ACESSO, CORREIOS_CARTAO_POSTAGEM e CORREIOS_CONTRATO.')

  const token = await getCorreiosToken(config)
  const { cidade, uf } = splitCityState(params.destination.city)
  const destinationPhone = splitPhone(params.destination.phone)

  const payload = {
    remetente: {
      nome: storeConfig.legalName,
      cpfCnpj: onlyDigits(storeConfig.document),
      endereco: {
        logradouro: storeConfig.address.street,
        numero: storeConfig.address.number,
        bairro: storeConfig.address.neighborhood,
        cidade: storeConfig.address.city,
        uf: storeConfig.address.state,
        cep: onlyDigits(storeConfig.address.cep),
      },
    },
    destinatario: {
      nome: String(params.destination.name || 'Destinatário').slice(0, 50),
      cpfCnpj: onlyDigits(params.destination.document),
      dddTelefone: destinationPhone.ddd,
      telefone: destinationPhone.numero,
      email: params.destinationEmail || '',
      endereco: {
        logradouro: String(params.destination.address || '').slice(0, 50),
        numero: String(params.destination.number || 'S/N'),
        complemento: String(params.destination.complement || '').slice(0, 30),
        bairro: String(params.destination.neighborhood || cidade).slice(0, 30),
        cidade,
        uf,
        cep: onlyDigits(params.destination.cep),
      },
    },
    codigoServico: config.codigoServico,
    numeroContrato: config.contrato,
    numeroCartaoPostagem: config.cartaoPostagem,
    // 2 = pacote/caixa
    codigoFormatoObjetoInformado: '2',
    pesoInformado: String(Math.max(1, Math.round(params.pkg.weightGrams))),
    alturaInformada: String(Math.max(1, Math.round(params.pkg.heightCm))),
    larguraInformada: String(Math.max(1, Math.round(params.pkg.widthCm))),
    comprimentoInformado: String(Math.max(1, Math.round(params.pkg.lengthCm))),
    cienteObjetoNaoProibido: '1',
    itensDeclaracaoConteudo: params.items,
    observacao: `Pedido ${params.orderReference}`,
    ...(params.invoiceKey ? { chaveNFe: params.invoiceKey } : {}),
  }

  const response = await fetch(`${config.baseUrl}/prepostagem/v1/prepostagens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.codigoObjeto) {
    throw new Error(describeCorreiosError(data) || 'Os Correios recusaram a pré-postagem.')
  }

  return { codigoObjeto: String(data.codigoObjeto), id: String(data.id || '') }
}

export async function downloadLabelPdf(codigoObjeto: string) {
  const config = getCorreiosConfig()
  if (!config) throw new Error('Integração dos Correios não configurada.')

  const token = await getCorreiosToken(config)
  const requestResponse = await fetch(`${config.baseUrl}/prepostagem/v1/prepostagens/rotulo/assincrono/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      codigosObjeto: [codigoObjeto],
      idCorreios: config.usuario,
      tipoRotulo: 'P',
      formatoRotulo: 'ET',
      imprimeRemetente: 'S',
      layoutImpressao: 'PADRAO',
    }),
  })
  const requestData = await requestResponse.json().catch(() => null)
  if (!requestResponse.ok || !requestData?.idRecibo) {
    throw new Error(describeCorreiosError(requestData) || 'Não foi possível solicitar o rótulo aos Correios.')
  }

  // a geração do rótulo é assíncrona: o download responde 202 enquanto o PDF ainda está sendo montado
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const downloadResponse = await fetch(`${config.baseUrl}/prepostagem/v1/prepostagens/rotulo/download/assincrono/${requestData.idRecibo}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (downloadResponse.status === 202) continue
    const downloadData = await downloadResponse.json().catch(() => null)
    if (!downloadResponse.ok) throw new Error(describeCorreiosError(downloadData) || 'Não foi possível baixar o rótulo dos Correios.')
    if (downloadData?.dados) return String(downloadData.dados)
  }

  throw new Error('Os Correios ainda estão gerando o rótulo. Tente novamente em alguns instantes.')
}

function describeCorreiosError(data: any) {
  if (!data) return ''
  if (typeof data.msgs === 'object' && Array.isArray(data.msgs)) return data.msgs.join(' | ')
  return data.msg || data.message || data.error_description || ''
}
