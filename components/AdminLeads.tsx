import { useEffect, useState } from 'react'

type Status = 'new' | 'contacted' | 'proposal' | 'won' | 'lost'
type Lead = { id: string; created_at: string; name: string; email: string; phone: string; cep: string; city: string; state: string; service_type: string; details: string; equipment: { name: string; quantity: number }[]; estimated_total: number; status: Status; notes: string }
const labels: Record<Status, string> = { new: 'Novo', contacted: 'Em contato', proposal: 'Ganha', won: 'Perda', lost: 'Perdido' }
const columns: Status[] = ['new', 'contacted', 'proposal', 'won', 'lost']
type Props = { onMessage: (message: string) => void }
export default function AdminLeads({ onMessage }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  useEffect(() => { fetch('/api/leads').then((response) => response.ok ? response.json() : Promise.reject()).then(setLeads).catch(() => onMessage('Não foi possível carregar os leads. Execute scripts/leads.sql no Supabase.')) }, [onMessage])
  async function updateLead(lead: Lead, status: Status, notes = lead.notes) { const response = await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, status, notes }) }); if (!response.ok) return onMessage('Não foi possível atualizar o lead.'); const updated = await response.json(); setLeads((items) => items.map((item) => item.id === updated.id ? updated : item)); onMessage('Lead atualizado.') }
  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Excluir o lead de ${lead.name}? Essa ação não pode ser desfeita.`)) return
    const response = await fetch('/api/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) })
    if (!response.ok) return onMessage('Não foi possível excluir o lead.')
    setLeads((items) => items.filter((item) => item.id !== lead.id))
    onMessage('Lead excluído.')
  }
  function handleDrop(status: Status, event: React.DragEvent) {
    event.preventDefault()
    setDragOverColumn(null)
    const leadId = event.dataTransfer.getData('text/plain')
    const lead = leads.find((item) => item.id === leadId)
    if (lead && lead.status !== status) void updateLead(lead, status)
  }
  return <div className="lead-dashboard"><div className="lead-toolbar"><h2>Solicitações de orçamento</h2><p className="form-hint">Arraste os cards entre as colunas para mudar o status. Leads novos sem intera\u00e7\u00e3o por 2 dias v\u00e3o para Perdido automaticamente.</p></div><div className="lead-board">{columns.map((status) => { const columnLeads = leads.filter((lead) => lead.status === status); return <div className={`lead-column ${dragOverColumn === status ? 'drag-over' : ''}`} key={status} onDragOver={(event) => { event.preventDefault(); setDragOverColumn(status) }} onDragLeave={() => setDragOverColumn((current) => (current === status ? null : current))} onDrop={(event) => handleDrop(status, event)}><div className={`lead-column-header ${status}`}><span>{labels[status]}</span><strong>{columnLeads.length}</strong></div><div className="lead-column-body">{columnLeads.length === 0 && <p className="form-hint">Nenhum lead nesta etapa.</p>}{columnLeads.map((lead) => <article className="lead-card" key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', lead.id)}><div className="lead-card-main"><div><h3>{lead.name}</h3><p>{lead.service_type} · {lead.city}/{lead.state} · {new Date(lead.created_at).toLocaleString('pt-BR')}</p><p><a href={`mailto:${lead.email}`}>{lead.email}</a> · <a href={`tel:${lead.phone}`}>{lead.phone}</a> · CEP {lead.cep}</p></div><strong>R$ {Number(lead.estimated_total).toFixed(2).replace('.', ',')}</strong></div><p className="lead-details">{lead.details}</p><small>{lead.equipment.map((item) => `${item.name} (${item.quantity})`).join(' · ')}</small><div className="lead-actions"><input defaultValue={lead.notes} placeholder="Observação do atendimento" onBlur={(event) => updateLead(lead, lead.status, event.target.value)} /><button type="button" className="lead-delete-button" onClick={() => void deleteLead(lead)}>Excluir</button></div></article>)}</div></div> })}</div></div>
}
