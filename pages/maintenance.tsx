import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { storeConfig } from '../lib/store-config'
import { formatCep, formatDocument, formatPhone } from '../lib/formatters'

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

async function loadQuoteLogo() {
  const response = await fetch('/logo-header-uniform.jpg')
  if (!response.ok) throw new Error('Logo da loja não encontrada.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível carregar a logo da loja.'))
    reader.readAsDataURL(blob)
  })
}

export default function Maintenance() {
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('')
  const [coverage, setCoverage] = useState<{ distanceKm: number; withinRadius: boolean } | null>(null)
  const [loadingCep, setLoadingCep] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({})
  const [quoteReady, setQuoteReady] = useState(false)
  const [quotePdfUrl, setQuotePdfUrl] = useState('')
  const [quotePdfName, setQuotePdfName] = useState('')
  // true depois que o lead foi criado e o orçamento enviado: trava reenvio duplicado até o cliente alterar algo
  const [quoteSubmitted, setQuoteSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastPdfBase64, setLastPdfBase64] = useState('')

  function resetQuotePdf() { setQuotePdfUrl((previousUrl) => { if (previousUrl) URL.revokeObjectURL(previousUrl); return '' }); setQuotePdfName('') }
  function invalidateQuote() { setQuoteReady(false); setQuoteSubmitted(false); setLastPdfBase64(''); resetQuotePdf() }
  function update(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value })); if (quoteSubmitted) invalidateQuote() }
  function chooseService(type: ServiceType) { setServiceType(type); setStatus(''); setCoverage(null); invalidateQuote() }
  function toggleEquipment(id: string, checked: boolean) { setSelectedEquipment((current) => ({ ...current, [id]: checked ? 1 : 0 })); invalidateQuote() }
  function setEquipmentQuantity(id: string, quantity: string) { setSelectedEquipment((current) => ({ ...current, [id]: Math.max(1, Number(quantity) || 1) })); invalidateQuote() }

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
      setCoverage(validCoverage); invalidateQuote(); setStatus(validCoverage.withinRadius ? `Atendimento disponível. ${travelMessage}` : `Este endereço está fora do raio de atendimento de ${storeConfig.serviceRadiusKm} km.`)
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
    if (submitting) return
    if (!coverage?.withinRadius) return setStatus('Consulte um CEP dentro da área de atendimento antes de continuar.')
    if (!Object.values(selectedEquipment).some((quantity) => quantity > 0)) return setStatus('Selecione ao menos um equipamento para gerar o orçamento.')
    if (quoteSubmitted && lastPdfBase64) {
      void resendQuote()
      return
    }
    setQuoteReady(true)
    setStatus('Gerando orçamento em PDF...')
    void downloadQuote()
  }

  async function resendQuote() {
    setSubmitting(true)
    setStatus('Reenviando orçamento por e-mail...')
    try {
      const response = await fetch('/api/send-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfBase64: lastPdfBase64, customerName: form.name, customerEmail: form.email, cep: form.cep, serviceType: serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato mensal' }) })
      const result = await response.json()
      if (result.sent) setStatus('Orçamento reenviado por e-mail para você e para a loja.')
      else if (result.configured === false) setStatus('Envio automático por e-mail ainda não foi configurado (SMTP).')
      else setStatus(result.error || 'Não foi possível reenviar o orçamento por e-mail.')
    } catch { setStatus('Não foi possível reenviar o orçamento agora.') }
    finally { setSubmitting(false) }
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
    setSubmitting(true)
    try {
      const leadResponse = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, serviceType: serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato mensal', details: form.details, equipment: selectedRows.map((equipment) => ({ name: equipment.name, quantity: equipment.quantity, unitPrice: equipment.price })), estimatedTotal: quoteTotal }) })
      if (!leadResponse.ok) {
        const leadResult = await leadResponse.json().catch(() => ({}))
        throw new Error(leadResult.error || 'Não foi possível registrar a solicitação.')
      }
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF()
      const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
      const logo = await loadQuoteLogo().catch(() => null)
      const colors = { ink: [31, 36, 41] as [number, number, number], red: [190, 45, 48] as [number, number, number], pale: [246, 247, 248] as [number, number, number], line: [220, 223, 226] as [number, number, number], muted: [102, 109, 116] as [number, number, number] }
      const margin = 18
      const contentWidth = 174
      const serviceLabel = serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato Mensal'

      function drawHeader(title = 'ORÇAMENTO DE MANUTENÇÃO', subtitle = serviceLabel) {
        pdf.setFillColor(...colors.ink); pdf.rect(0, 0, 210, 43, 'F')
        if (logo) pdf.addImage(logo, 'JPEG', margin, 8, 42, 18, undefined, 'FAST')
        else { pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.text('ALPHA TEC', margin, 20) }
        pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text(title, 205, 17, { align: 'right' })
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(subtitle.toUpperCase(), 205, 26, { align: 'right' })
        pdf.setFillColor(...colors.red); pdf.rect(0, 40, 210, 3, 'F')
        pdf.setTextColor(...colors.ink)
      }

      function drawFooter() {
        const pageNumber = pdf.getNumberOfPages()
        pdf.setDrawColor(...colors.line); pdf.line(margin, 282, 192, 282)
        pdf.setTextColor(...colors.muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
        pdf.text('ALPHA TEC LTDA  |  Orçamento válido por 7 dias, sujeito à confirmação técnica.', margin, 288)
        pdf.text(`Página ${pageNumber}`, 192, 288, { align: 'right' })
      }

      function drawLabelValue(label: string, value: string, x: number, y: number, width: number) {
        pdf.setTextColor(...colors.muted); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text(label.toUpperCase(), x, y)
        pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
        const lines = pdf.splitTextToSize(value || 'Não informado', width)
        pdf.text(lines.slice(0, 2), x, y + 5)
      }

      drawHeader()
      pdf.setFillColor(...colors.pale); pdf.roundedRect(margin, 54, contentWidth, 37, 2, 2, 'F')
      pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('DADOS DO CLIENTE', margin + 5, 62)
      drawLabelValue('Cliente', form.name, margin + 5, 70, 76)
      drawLabelValue('CPF/CNPJ', form.document, 108, 70, 76)
      drawLabelValue('Endereço', `${form.street}, ${form.number} - ${form.city}/${form.state}`, margin + 5, 82, 76)
      drawLabelValue('CEP', form.cep, 108, 82, 76)

      pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('COMPOSIÇÃO DO ORÇAMENTO', margin, 105)
      const tableTop = 111
      pdf.setFillColor(...colors.ink); pdf.roundedRect(margin, tableTop, contentWidth, 10, 1, 1, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8)
      pdf.text('DESCRIÇÃO', margin + 5, tableTop + 6.5); pdf.text('QTD.', 126, tableTop + 6.5, { align: 'center' }); pdf.text('UNITÁRIO', 160, tableTop + 6.5, { align: 'right' }); pdf.text('TOTAL', 187, tableTop + 6.5, { align: 'right' })

      const rows: { description: string; quantity: string; unit: string; total: string }[] = serviceType === 'seasonal'
        ? [{ description: 'Visita Técnica Especializada', quantity: '1', unit: money(visitTotal), total: money(visitTotal) }]
        : selectedRows.map((equipment) => ({ description: equipment.name, quantity: String(equipment.quantity), unit: money(equipment.price), total: money(equipment.price * equipment.quantity) }))
      if (travelTotal > 0) rows.push({ description: 'Taxa de deslocamento', quantity: '1', unit: money(travelTotal), total: money(travelTotal) })
      if (tollTotal > 0) rows.push({ description: 'Pedágios', quantity: '1', unit: money(tollTotal), total: money(tollTotal) })

      let y = tableTop + 10
      rows.forEach((row, index) => {
        const descriptionLines = pdf.splitTextToSize(row.description, 91)
        const rowHeight = Math.max(10, descriptionLines.length * 4.5 + 5)
        if (index % 2 === 0) { pdf.setFillColor(...colors.pale); pdf.rect(margin, y, contentWidth, rowHeight, 'F') }
        pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(descriptionLines, margin + 5, y + 6)
        pdf.text(row.quantity, 126, y + 6, { align: 'center' }); pdf.text(row.unit, 160, y + 6, { align: 'right' }); pdf.setFont('helvetica', 'bold'); pdf.text(row.total, 187, y + 6, { align: 'right' })
        pdf.setDrawColor(...colors.line); pdf.line(margin, y + rowHeight, 192, y + rowHeight); y += rowHeight
      })

      const totalBoxY = y + 10
      pdf.setFillColor(...colors.red); pdf.roundedRect(112, totalBoxY, 80, 25, 2, 2, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('TOTAL DO ORÇAMENTO', 118, totalBoxY + 8)
      pdf.setFontSize(16); pdf.text(money(quoteTotal), 186, totalBoxY + 19, { align: 'right' })
      pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('OBSERVAÇÕES', margin, totalBoxY + 8)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...colors.muted)
      pdf.text(pdf.splitTextToSize(form.details || 'Serviço conforme avaliação técnica no local.', 84).slice(0, 4), margin, totalBoxY + 15)
      drawFooter()

      const infoBlocks = serviceType === 'seasonal'
        ? [
          { heading: 'Escopo do atendimento', text: `A Visita Técnica Especializada (${money(visitTotal)}) é um serviço preventivo e corretivo completo, realizado para identificar a causa do problema e restabelecer a segurança e o desempenho do equipamento.` },
          { heading: 'O que está incluído', text: 'Diagnóstico preciso e identificação da causa raiz.\nLimpeza técnica dos componentes internos vitais.\nLubrificação técnica para reduzir atrito e desgaste.\nAjustes, calibração e alinhamento geral do equipamento.' },
          { heading: 'Em caso de troca de peças', text: 'Sempre que possível, o problema será solucionado durante o primeiro atendimento. Se houver necessidade de substituição, um orçamento específico será enviado para aprovação. O valor das peças fica por conta do cliente.' },
          { heading: 'Retorno e garantia de serviço', text: travelTotal > 0
            ? `O retorno para instalação de uma peça aprovada não terá custo de mão de obra. Será cobrada apenas a taxa de deslocamento no valor de ${money(travelTotal)}.`
            : 'O retorno para instalação de uma peça aprovada já está incluído no valor inicial da visita. Não há nova taxa de visita para concluir o serviço.' },
        ]
        : [
          { heading: 'Sobre o plano mensal', text: 'A Manutenção Preventiva Especializada antecipa falhas, prolonga a vida útil dos equipamentos e mantém sua estrutura disponível com mais segurança e previsibilidade.' },
          { heading: 'O que está incluído', text: 'Higienização e limpeza interna.\nLubrificação de motores, placas e componentes mecânicos.\nAjustes, tensionamento e alinhamento de lonas, correias e cabos.\nRevisão elétrica, eletrônica e relatório técnico de condição.' },
          { heading: 'Benefícios para sua operação', text: 'Redução do risco de quebras graves e gastos emergenciais.\nMaior durabilidade do patrimônio.\nMais segurança para os usuários.\nEquipamentos disponíveis por mais tempo, com performance consistente.' },
        ]

      let infoY = 62
      function startInfoPage() { pdf.addPage(); drawHeader('INFORMATIVO TÉCNICO', serviceLabel); infoY = 62 }
      startInfoPage()
      infoBlocks.forEach((block) => {
        const lines = pdf.splitTextToSize(block.text, 164)
        const blockHeight = 12 + lines.length * 5 + 10
        if (infoY + blockHeight > 270) { drawFooter(); startInfoPage() }
        pdf.setFillColor(...colors.pale); pdf.roundedRect(margin, infoY, contentWidth, blockHeight, 2, 2, 'F')
        pdf.setTextColor(...colors.red); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text(block.heading, margin + 6, infoY + 9)
        pdf.setTextColor(...colors.ink); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
        pdf.text(lines, margin + 6, infoY + 18, { lineHeightFactor: 1.35 }); infoY += blockHeight + 8
      })
      drawFooter()
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const pdfFileName = `orcamento-alpha-tec-${form.cep || 'manutencao'}.pdf`
      setQuotePdfUrl((previousUrl) => { if (previousUrl) URL.revokeObjectURL(previousUrl); return pdfUrl })
      setQuotePdfName(pdfFileName)
      window.open(pdfUrl, '_blank')
      setStatus('Orçamento gerado e aberto em uma nova aba. Use o botão abaixo se quiser baixar o PDF.')
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })
      setLastPdfBase64(pdfBase64)
      setQuoteSubmitted(true)
      try {
        const response = await fetch('/api/send-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfBase64, customerName: form.name, customerEmail: form.email, cep: form.cep, serviceType: serviceType === 'seasonal' ? 'Visita Técnica' : 'Contrato mensal' }) })
        const result = await response.json()
        if (result.sent) setStatus('Orçamento gerado, aberto em PDF e enviado por e-mail para você e para a loja.')
        else if (result.configured === false) setStatus('Orçamento gerado e aberto em PDF. O envio automático por e-mail ainda não foi configurado (SMTP) — anexe o PDF manualmente por enquanto.')
        else setStatus(result.error || 'Orçamento gerado e aberto em PDF, mas não foi possível enviar por e-mail.')
      } catch { setStatus('Orçamento gerado e aberto em PDF. O envio por e-mail ficará pendente.') }
    } catch { setStatus('Não foi possível gerar o PDF. Atualize a página e tente novamente.') }
    finally { setSubmitting(false) }
  }

  function downloadQuotePdf() {
    if (!quotePdfUrl) return
    const downloadLink = document.createElement('a')
    downloadLink.href = quotePdfUrl
    downloadLink.download = quotePdfName || 'orcamento-alpha-tec.pdf'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    downloadLink.remove()
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
      <fieldset><legend>1. Verifique seu CEP</legend><div className="cep-field large"><input required value={formatCep(form.cep)} onChange={(event) => update('cep', formatCep(event.target.value))} placeholder="00000-000" /><button type="button" onClick={lookupCep}>{loadingCep ? 'Buscando' : 'Consultar cobertura'}</button></div>{status && <p className={coverage?.withinRadius ? 'form-status success' : 'form-status'}>{status}</p>}</fieldset>
      {coverage?.withinRadius && <><fieldset><legend>2. Seus dados</legend><div className="form-grid"><label>CPF ou CNPJ<input required value={formatDocument(form.document)} onChange={(event) => update('document', formatDocument(event.target.value))} /></label><label>Nome completo ou empresa<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label>E-mail<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label>Telefone<input required value={formatPhone(form.phone)} onChange={(event) => update('phone', formatPhone(event.target.value))} /></label></div></fieldset>
      <fieldset><legend>3. Endereço do atendimento</legend><div className="form-grid"><label>Rua / avenida<input required value={form.street} onChange={(event) => update('street', event.target.value)} /></label><label>Número<input required value={form.number} onChange={(event) => update('number', event.target.value)} /></label><label>Complemento<input value={form.complement} onChange={(event) => update('complement', event.target.value)} /></label><label>Bairro<input required value={form.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} /></label><label>Cidade<input required value={form.city} onChange={(event) => update('city', event.target.value)} /></label><label>Estado<input required maxLength={2} value={form.state} onChange={(event) => update('state', event.target.value)} /></label></div></fieldset>
      <fieldset><legend>4. Equipamentos e detalhes</legend><p className="form-hint">Selecione os equipamentos e informe as quantidades necessárias.</p><div className="equipment-list">{equipmentList.map((equipment) => <label className="equipment-row" key={equipment.id}><input type="checkbox" checked={Boolean(selectedEquipment[equipment.id])} onChange={(event) => toggleEquipment(equipment.id, event.target.checked)} /><span><strong>{equipment.name}</strong><small>{equipment.description}</small></span>{selectedEquipment[equipment.id] && <input className="quantity" type="number" min="1" value={selectedEquipment[equipment.id]} onChange={(event) => setEquipmentQuantity(equipment.id, event.target.value)} aria-label={`Quantidade de ${equipment.name}`} />}</label>)}</div><p className="form-hint">Pedágios aplicáveis serão verificados pela Alpha Tec na análise da rota.</p><label className="wide">Descreva o problema / observações<textarea required rows={4} value={form.details} onChange={(event) => update('details', event.target.value)} /></label></fieldset>
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : quoteSubmitted ? 'Reenviar orçamento' : 'Gerar orçamento'} <span>→</span></button>{quoteReady && <div className="quote-result"><strong>Orçamento disponível em PDF</strong><div className="quote-actions"><button className="download-button" type="button" onClick={downloadQuotePdf} disabled={!quotePdfUrl}>Baixar PDF do orçamento</button><button className="email-button" type="button" onClick={openEmailDraft}>Preparar e-mail</button></div></div>}</>}
    </form>}
  </section>
}
