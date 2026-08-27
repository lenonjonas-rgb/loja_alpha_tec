import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { storeConfig } from '../lib/store-config'

type ServiceType = 'seasonal' | 'monthly'
type FormState = { document: string; name: string; email: string; phone: string; cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; equipment: string; quantity: string; details: string; toll: string }
type Equipment = { id: string; name: string; description: string; price: number }

const equipmentList: Equipment[] = [
  { id: 'esteira', name: 'Esteira', description: 'Inspeção e manutenção preventiva', price: 70 },
  { id: 'bike', name: 'Bicicleta ergométrica', description: 'Revisão de bike e componentes', price: 50 },
  { id: 'eliptico', name: 'Elíptico', description: 'Avaliação de partes e ajustes', price: 50 },
  { id: 'musculacao', name: 'Equipamento de musculação', description: 'Cabos, polias e estrutura', price: 50 },
]

const initialForm: FormState = { document: '', name: '', email: '', phone: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', equipment: '', quantity: '1', details: '', toll: '0' }
const technicalVisitFee = 250

export default function Maintenance() {
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('')
  const [coverage, setCoverage] = useState<{ distanceKm: number; withinRadius: boolean } | null>(null)
  const [loadingCep, setLoadingCep] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({})
  const [quoteReady, setQuoteReady] = useState(false)

  function update(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value })) }
  function chooseService(type: ServiceType) { setServiceType(type); setStatus(''); setCoverage(null); setQuoteReady(false) }
  function toggleEquipment(id: string, checked: boolean) { setSelectedEquipment((current) => ({ ...current, [id]: checked ? 1 : 0 })); setQuoteReady(false) }
  function setEquipmentQuantity(id: string, quantity: string) { setSelectedEquipment((current) => ({ ...current, [id]: Math.max(1, Number(quantity) || 1) })); setQuoteReady(false) }

  async function lookupCep() {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) return setStatus('Digite um CEP com 8 números.')
    setLoadingCep(true); setStatus('')
    try {
      const response = await fetch(`/api/cep?cep=${cep}`); const result = await readJson(response)
      if (!response.ok) throw new Error(result.error)
      if (!result.address) throw new Error('O CEP não retornou um endereço válido.')
      update('street', result.address.logradouro || ''); update('neighborhood', result.address.bairro || ''); update('city', result.address.localidade || ''); update('state', result.address.uf || '')
      const coverageResponse = await fetch(`/api/coverage?cep=${cep}`); const coverageResult = await readJson(coverageResponse)
      if (!coverageResponse.ok) throw new Error(coverageResult.error)
      if (typeof coverageResult.distanceKm !== 'number' || typeof coverageResult.withinRadius !== 'boolean') throw new Error('A análise de cobertura retornou dados incompletos.')
      const validCoverage = { distanceKm: coverageResult.distanceKm, withinRadius: coverageResult.withinRadius }
      const roundTripDistance = validCoverage.distanceKm * 2
      const travelMessage = validCoverage.distanceKm < 30
        ? 'Deslocamento isento para este endereço.'
        : `Deslocamento ida e volta: R$ ${roundTripDistance.toFixed(2).replace('.', ',')}.`
      setCoverage(validCoverage); setQuoteReady(false); setStatus(validCoverage.withinRadius ? `Atendimento disponível. ${travelMessage}` : `Este endereço está fora do raio de atendimento de ${storeConfig.serviceRadiusKm} km.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.') }
    finally { setLoadingCep(false) }
  }

  async function readJson(response: Response) {
    const body = await response.text()
    try { return JSON.parse(body) as { error?: string; address?: Record<string, string>; distanceKm?: number; withinRadius?: boolean } }
    catch { throw new Error('O servidor reiniciou durante a consulta. Atualize a página e tente novamente.') }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!coverage?.withinRadius) return setStatus('Consulte um CEP dentro da área de atendimento antes de continuar.')
    if (!Object.values(selectedEquipment).some((quantity) => quantity > 0)) return setStatus('Selecione ao menos um equipamento para gerar o orçamento.')
    setQuoteReady(true)
    setStatus('Orçamento gerado. O PDF foi aberto em uma nova aba.')
    void downloadQuote()
  }

  const selectedRows = equipmentList.filter((equipment) => (selectedEquipment[equipment.id] || 0) > 0).map((equipment) => ({ ...equipment, quantity: selectedEquipment[equipment.id] || 0 }))
  const equipmentCount = selectedRows.reduce((total, equipment) => total + equipment.quantity, 0)
  const mostExpensiveEquipment = selectedRows.reduce((mostExpensive, equipment) => Math.max(mostExpensive, equipment.price), 0)
  const equipmentTotal = serviceType === 'seasonal'
    ? (equipmentCount > 2 ? (equipmentCount - 2) * mostExpensiveEquipment : 0)
    : selectedRows.reduce((total, equipment) => total + equipment.price * equipment.quantity, 0)
  const roundTripKm = coverage && coverage.distanceKm >= 30 ? coverage.distanceKm * 2 : 0
  const travelTotal = roundTripKm
  const tollTotal = Number(form.toll || 0)
  const visitFee = serviceType === 'seasonal' ? technicalVisitFee : 0
  const quoteTotal = equipmentTotal + visitFee + travelTotal + tollTotal
  const seasonalDistancePrice = travelTotal
  const visitTotal = technicalVisitFee + equipmentTotal

  async function downloadQuote() {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF()
    const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
    pdf.setFontSize(18); pdf.text('ALPHA TEC', 20, 22); pdf.setFontSize(10); pdf.text('ORÇAMENTO DE MANUTENÇÃO', 20, 30)
    pdf.line(20, 35, 190, 35); pdf.text(`Tipo: ${serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato mensal'}`, 20, 45); pdf.text(`Cliente: ${form.name || 'Não informado'}`, 20, 52); pdf.text(`CPF/CNPJ: ${form.document || 'Não informado'}`, 20, 59); pdf.text(`Endereço: ${form.street}, ${form.number} - ${form.city}/${form.state}`, 20, 66); pdf.text(`CEP: ${form.cep}`, 20, 73)
    let y = 87; pdf.setFontSize(11); pdf.text('ITEM', 20, y); pdf.text('QTD.', 125, y); pdf.text('UNITÁRIO', 145, y); pdf.text('TOTAL', 177, y); y += 8; pdf.setFontSize(10)
    if (serviceType === 'seasonal') {
      pdf.text('Visita Técnica Especializada', 20, y); pdf.text('1', 128, y); pdf.text(money(visitTotal), 145, y); pdf.text(money(visitTotal), 177, y); y += 7
    } else {
      selectedRows.forEach((equipment) => { pdf.text(equipment.name, 20, y); pdf.text(String(equipment.quantity), 128, y); pdf.text(money(equipment.price), 145, y); pdf.text(money(equipment.price * equipment.quantity), 177, y); y += 7 })
    }
    pdf.text('Deslocamento', 20, y); pdf.text(money(travelTotal), 177, y); y += 7
    if (tollTotal > 0) { pdf.text('Pedágios', 20, y); pdf.text(money(tollTotal), 177, y); y += 7 }
    pdf.line(20, y + 2, 190, y + 2); pdf.setFontSize(13); pdf.text(`TOTAL: ${money(quoteTotal)}`, 135, y + 12); pdf.setFontSize(9); pdf.text('Orçamento sujeito à confirmação técnica e validade de 7 dias.', 20, y + 28)
    if (serviceType === 'seasonal') {
      pdf.addPage(); pdf.setFontSize(15); pdf.text('INFORMATIVO TÉCNICO & GARANTIA DE SERVIÇO', 20, 22); pdf.setFontSize(11); pdf.text('Nosso Compromisso com o Seu Equipamento', 20, 31)
      const information = `Para garantir a melhor performance, durabilidade e segurança do seu equipamento, nosso atendimento não é apenas uma checagem rápida. A Visita Técnica Especializada (${money(visitTotal)}) é um serviço preventivo e corretivo completo que inclui:\n\n- Diagnóstico preciso: identificação detalhada da causa raiz do problema.\n- Limpeza técnica: remoção de resíduos, poeira e sujidades nos componentes internos vitais.\n- Lubrificação técnica: aplicação de lubrificantes específicos para reduzir o atrito e estender a vida útil das peças.\n- Ajustes e calibração: regulagem mecânica e alinhamento geral do equipamento.\n\nCOMO FUNCIONA EM CASO DE TROCA DE PEÇAS:\n\n1. Ação imediata: sempre que possível, o problema é solucionado diretamente durante o primeiro atendimento.\n2. Peças específicas: caso seja identificada a necessidade de substituição de componentes danificados ou desgastados, o orçamento da peça necessária será enviado para sua aprovação. O custo do componente fica por conta do cliente.\n3. Retorno sem custo adicional: o valor da segunda visita técnica para a instalação e montagem da nova peça já está incluso no valor inicial da visita. Não há nova taxa de visita para a conclusão do serviço.\n\nTRANSPARÊNCIA E RESPEITO AO SEU INVESTIMENTO:\nNosso objetivo é entregar o equipamento pronto para uso com total segurança, sem surpresas no orçamento.`
      let infoY = 44; pdf.setFontSize(10)
      information.split('\n').forEach((paragraph) => { const lines = pdf.splitTextToSize(paragraph, 170); if (infoY + lines.length * 5 > 275) { pdf.addPage(); infoY = 22 } pdf.text(lines, 20, infoY); infoY += lines.length * 5 + (paragraph ? 3 : 1) })
    } else {
      pdf.addPage(); pdf.setFontSize(15); pdf.text('INFORMATIVO TÉCNICO - PLANO DE MANUTENÇÃO PREVENTIVA', 20, 22); pdf.setFontSize(11); pdf.text('Proteja seu Investimento e Evite Paradas Inesperadas', 20, 31)
      const information = `A Manutenção Preventiva Especializada foi desenvolvida para anteceder falhas, prolongar a vida útil dos seus equipamentos e garantir a máxima segurança dos usuários. Em vez de remediar quebras dispendiosas, mantemos sua estrutura rodando com performance máxima.\n\nO QUE ESTÁ INCLUSO NA MANUTENÇÃO PREVENTIVA:\n\n- Higienização e limpeza interna: remoção de poeira, suor e resíduos acumulados em motores, placas e componentes mecânicos.\n- Lubrificação de alta performance: utilização de lubrificantes específicos para diminuir o atrito, aquecimento e desgaste prematuro.\n- Ajustes, tensionamento e alinhamento: regulagem de lonas, correias, cabos de aço e alinhamento mecânico geral.\n- Revisão elétrica e eletrônica: checagem de conexões, cabos, sensores e placas para evitar curtos ou picos de tensão.\n- Relatório técnico de condição: mapeamento visual e técnico do estado do equipamento, apontando peças com desgaste natural antes que venham a quebrar.\n\nPOR QUE INVESTIR NA PREVENTIVA?\n\n- Economia direta: reduz em até 70% o risco de quebras graves que exigem peças caras.\n- Maior durabilidade: aumenta expressivamente a vida útil do seu patrimônio.\n- Segurança garantida: minimiza o risco de acidentes causados por travamentos ou rompimento de cabos e correias.\n- Equipamento sempre disponível: evita que o equipamento fique fora de uso por dias aguardando peças.\n\nCONSISTÊNCIA É PERFORMANCE:\nEquipamentos bem regulados e lubrificados operam de forma mais silenciosa, suave e com menor consumo de energia.`
      let infoY = 44; pdf.setFontSize(10)
      information.split('\n').forEach((paragraph) => { const lines = pdf.splitTextToSize(paragraph, 170); if (infoY + lines.length * 5 > 275) { pdf.addPage(); infoY = 22 } pdf.text(lines, 20, infoY); infoY += lines.length * 5 + (paragraph ? 3 : 1) })
    }
    const pdfUrl = URL.createObjectURL(pdf.output('blob'))
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    const pdfBlob = pdf.output('blob')
    const pdfBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
      reader.onerror = reject
      reader.readAsDataURL(pdfBlob)
    })
    try {
      const response = await fetch('/api/send-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfBase64, customerName: form.name, cep: form.cep, serviceType: serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato mensal' }) })
      const result = await response.json()
      if (result.sent) setStatus('Orçamento gerado, aberto em PDF e enviado por e-mail.')
    } catch { setStatus('Orçamento gerado e aberto em PDF. O envio por e-mail ficará pendente.') }
  }

  function openEmailDraft() {
    const recipients = storeConfig.quoteEmailRecipients.join(',')
    const subject = encodeURIComponent(`Orçamento Alpha Tec - ${form.name || 'solicitação de manutenção'}`)
    const body = encodeURIComponent(`Novo orçamento de manutenção.\nCliente: ${form.name}\nCEP: ${form.cep}\nTipo: ${serviceType === 'seasonal' ? 'Manutenção sazonal' : 'Contrato mensal'}\nO PDF foi aberto para ser anexado.`)
    window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`
  }
  return <section className="maintenance-page container">
    <Link href="/" className="back-link">← Voltar para a loja</Link>
    <div className="maintenance-intro"><p className="eyebrow">ATENDIMENTO TÉCNICO</p><h1>Quero manutenção</h1><p>Escolha o tipo de atendimento. Depois informe apenas o CEP para verificarmos a cobertura em um raio de {storeConfig.serviceRadiusKm} km.</p></div>
    <div className="service-choice"><button className={serviceType === 'seasonal' ? 'choice active' : 'choice'} onClick={() => chooseService('seasonal')} type="button"><strong>Visita Técnica</strong><span>Atendimento técnico especializado</span></button><button className={serviceType === 'monthly' ? 'choice active' : 'choice'} onClick={() => chooseService('monthly')} type="button"><strong>Contrato mensal</strong><span>Plano recorrente para sua academia</span></button></div>
    {!serviceType && <p className="form-hint">Selecione uma opção para começar.</p>}
    {serviceType && <form className="maintenance-form" onSubmit={submit}>
      <fieldset><legend>1. Verifique seu CEP</legend><div className="cep-field large"><input required value={form.cep} onChange={(event) => update('cep', event.target.value)} placeholder="00000-000" /><button type="button" onClick={lookupCep}>{loadingCep ? 'Buscando' : 'Consultar cobertura'}</button></div>{status && <p className={coverage?.withinRadius ? 'form-status success' : 'form-status'}>{status}</p>}</fieldset>
      {coverage?.withinRadius && <><fieldset><legend>2. Seus dados</legend><div className="form-grid"><label>CPF ou CNPJ<input required value={form.document} onChange={(event) => update('document', event.target.value)} /></label><label>Nome completo ou empresa<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label>E-mail<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label>Telefone<input required value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label></div></fieldset>
      <fieldset><legend>3. Endereço do atendimento</legend><div className="form-grid"><label>Rua / avenida<input required value={form.street} onChange={(event) => update('street', event.target.value)} /></label><label>Número<input required value={form.number} onChange={(event) => update('number', event.target.value)} /></label><label>Complemento<input value={form.complement} onChange={(event) => update('complement', event.target.value)} /></label><label>Bairro<input required value={form.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} /></label><label>Cidade<input required value={form.city} onChange={(event) => update('city', event.target.value)} /></label><label>Estado<input required maxLength={2} value={form.state} onChange={(event) => update('state', event.target.value)} /></label></div></fieldset>
      <fieldset><legend>4. Equipamentos e detalhes</legend><p className="form-hint">Selecione os equipamentos e informe as quantidades necessárias.</p><div className="equipment-list">{equipmentList.map((equipment) => <label className="equipment-row" key={equipment.id}><input type="checkbox" checked={Boolean(selectedEquipment[equipment.id])} onChange={(event) => toggleEquipment(equipment.id, event.target.checked)} /><span><strong>{equipment.name}</strong><small>{equipment.description}</small></span>{selectedEquipment[equipment.id] && <input className="quantity" type="number" min="1" value={selectedEquipment[equipment.id]} onChange={(event) => setEquipmentQuantity(equipment.id, event.target.value)} aria-label={`Quantidade de ${equipment.name}`} />}</label>)}</div><p className="form-hint">Pedágios aplicáveis serão verificados pela Alpha Tec na análise da rota.</p><label className="wide">Descreva o problema / observações<textarea required rows={4} value={form.details} onChange={(event) => update('details', event.target.value)} /></label></fieldset>
      <button className="primary-button" type="submit">Gerar orçamento <span>→</span></button>{quoteReady && <div className="quote-result"><strong>Orçamento disponível em PDF</strong><div className="quote-actions"><button className="download-button" type="button" onClick={downloadQuote}>Abrir PDF do orçamento</button><button className="email-button" type="button" onClick={openEmailDraft}>Preparar e-mail</button></div></div>}</>}
    </form>}
  </section>
}
