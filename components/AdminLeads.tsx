import { useEffect, useState } from 'react'

type Status = 'new' | 'contacted' | 'proposal' | 'won' | 'lost'
type Lead = { id: string; created_at: string; name: string; email: string; phone: string; cep: string; city: string; state: string; service_type: string; details: string; equipment: { name: string; quantity: number }[]; estimated_total: number; status: Status; notes: string }
const labels: Record<Status, string> = { new: 'Novo', contacted: 'Em contato', proposal: 'Ganha', won: 'Perda', lost: 'Perdido' }
const columns: Status[] = ['new', 'contacted', 'proposal', 'won', 'lost']
type Props = { onMessage: (message: string) => void }

export default function AdminLeads({ onMessage }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [activeStatus, setActiveStatus] = useState<Status>('new')
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/leads')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setLeads)
      .catch(() => onMessage('Não foi possível carregar os leads. Execute scripts/leads.sql no Supabase.'))
  }, [onMessage])

  async function updateLead(lead: Lead, status: Status, notes = lead.notes) {
    const response = await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, status, notes }) })
    if (!response.ok) return onMessage('Não foi possível atualizar o lead.')
    const updated = await response.json()
    setLeads((items) => items.map((item) => item.id === updated.id ? updated : item))
    onMessage('Lead atualizado.')
  }

  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Excluir o lead de ${lead.name}? Essa ação não pode ser desfeita.`)) return
    const response = await fetch('/api/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) })
    if (!response.ok) return onMessage('Não foi possível excluir o lead.')
    setLeads((items) => items.filter((item) => item.id !== lead.id))
    onMessage('Lead excluído.')
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const visibleLeads = leads.filter((lead) => lead.status === activeStatus)

  return <div className="lead-dashboard">
    <div className="lead-toolbar">
      <div><h2>Solicitações de orçamento</h2><p className="form-hint">Selecione um status para ver os leads.</p></div>
    </div>
    <nav className="lead-status-tabs" aria-label="Status dos leads">
      {columns.map((status) => <button key={status} type="button" className={activeStatus === status ? `active ${status}` : ''} onClick={() => { setActiveStatus(status); setExpandedIds([]) }}><span>{labels[status]}</span><strong>{leads.filter((lead) => lead.status === status).length}</strong></button>)}
    </nav>
    <section className="lead-status-panel">
      <div className="order-list-toolbar"><span>{visibleLeads.length} lead(s) em {labels[activeStatus].toLowerCase()}</span></div>
      {!visibleLeads.length && <p className="form-hint">Nenhum lead nesta etapa.</p>}
      {visibleLeads.map((lead) => {
        const expanded = expandedIds.includes(lead.id)
        return <article className={`lead-card ${expanded ? 'expanded' : ''}`} key={lead.id} onClick={() => toggleExpanded(lead.id)}>
          <div className="lead-summary">
            <div className="lead-summary-main"><h3>{lead.name}</h3><p>{lead.service_type} · {lead.city}/{lead.state} · {new Date(lead.created_at).toLocaleString('pt-BR')}</p></div>
            <strong>R$ {Number(lead.estimated_total).toFixed(2).replace('.', ',')}</strong>
            <span className="order-expand-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
          </div>
          {expanded && <div className="lead-details-panel" onClick={(event) => event.stopPropagation()}>
            <p><a href={`mailto:${lead.email}`}>{lead.email}</a> · <a href={`tel:${lead.phone}`}>{lead.phone}</a> · CEP {lead.cep}</p>
            <p className="lead-details">{lead.details}</p>
            <small>{lead.equipment.map((item) => `${item.name} (${item.quantity})`).join(' · ')}</small>
            <div className="lead-actions lead-detail-actions">
              <select value={lead.status} onChange={(event) => void updateLead(lead, event.target.value as Status)}>{columns.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select>
              <input defaultValue={lead.notes} placeholder="Observação do atendimento" onBlur={(event) => { if (event.target.value !== lead.notes) void updateLead(lead, lead.status, event.target.value) }} />
              <button type="button" className="lead-delete-button" onClick={() => void deleteLead(lead)}>Excluir</button>
            </div>
          </div>}
        </article>
      })}
    </section>
  </div>
}
