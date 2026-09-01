// Links de rastreio das transportadoras pré-cadastradas em pages/api/shipping.ts
// Observação importante: apenas os Correios têm um parâmetro de URL documentado (?objetos=CODIGO)
// que pré-preenche o campo de rastreio. Jamef, Rodonaves e Expresso São Miguel exigem
// CPF/CNPJ e, em alguns casos, chave de nota fiscal — não é possível pré-preencher o código
// digitado no admin diretamente nesses sites. Para essas transportadoras, o link abre a
// página oficial de rastreio para o operador preencher manualmente.
const trackingUrlBuilders: Record<string, (code: string) => string> = {
  'Correios': (code) => `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`,
  'Jamef': () => 'https://cliente.jamef.com.br/rastreio',
  'Rodonaves': () => 'https://rodonaves.com.br/',
  'Total Express': () => 'https://totalconecta.totalexpress.com.br/rastreamento',
  'Expresso São Miguel': () => 'https://portaldocliente.expressosaomiguel.com.br/rastrear-mercadoria',
}

export function getCarrierTrackingUrl(carrier: string | null | undefined, trackingCode: string | null | undefined) {
  if (!carrier || !trackingCode) return null
  const builder = trackingUrlBuilders[carrier]
  return builder ? builder(trackingCode) : null
}
