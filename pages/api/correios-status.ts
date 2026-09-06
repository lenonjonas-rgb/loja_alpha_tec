import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCorreiosConfig, getCorreiosToken } from '../../lib/correios'

function isAdmin(req: NextApiRequest) {
  const [username, provided] = (req.cookies.alpha_admin_session || '.').split('.')
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'alpha-local-secret').update(username || '').digest('hex')
  return Boolean(username === process.env.ALPHA_MASTER_USER && provided && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado.' })

  const missing = ['CORREIOS_USUARIO', 'CORREIOS_CODIGO_ACESSO', 'CORREIOS_CARTAO_POSTAGEM', 'CORREIOS_CONTRATO'].filter((name) => !process.env[name])
  if (missing.length) {
    return res.status(200).json({ authenticated: false, missing, message: `Faltam variáveis na Vercel: ${missing.join(', ')}.` })
  }

  const config = getCorreiosConfig()!
  const diagnostics = {
    ambiente: process.env.CORREIOS_AMBIENTE === 'homologacao' ? 'homologacao' : 'producao',
    baseUrl: config.baseUrl,
    usuario: `${config.usuario.slice(0, 2)}***`,
    codigoAcessoTamanho: config.codigoAcesso.length,
    cartaoPostagemTamanho: config.cartaoPostagem.replace(/\D/g, '').length,
    contratoTamanho: config.contrato.replace(/\D/g, '').length,
    codigoServico: config.codigoServico,
  }

  try {
    await getCorreiosToken(config)
    return res.status(200).json({ authenticated: true, ...diagnostics, message: 'Autenticação nos Correios funcionando.' })
  } catch (error) {
    return res.status(200).json({
      authenticated: false,
      ...diagnostics,
      message: error instanceof Error ? error.message : 'Falha na autenticação.',
    })
  }
}
