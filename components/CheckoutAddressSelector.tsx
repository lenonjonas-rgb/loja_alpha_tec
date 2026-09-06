import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useCustomer } from './CustomerContext'
import { formatCep } from '../lib/formatters'

type Address = { id: string; label: string; cep: string; address: string; number: string; complement: string; city: string }

function currentAddress(customer: NonNullable<ReturnType<typeof useCustomer>['customer']>): Address {
  return { id: 'current', label: 'Endereço principal', cep: customer.cep, address: customer.address, number: customer.number, complement: customer.complement, city: customer.city }
}

export default function CheckoutAddressSelector() {
  const router = useRouter()
  const { customer } = useCustomer()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState('current')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Address | null>(null)

  useEffect(() => {
    if (router.pathname !== '/checkout' || !customer?.id) return
    let saved: Address[] = []
    try { saved = JSON.parse(localStorage.getItem(`alpha-addresses-${customer.id}`) || '[]') } catch { saved = [] }
    const options = [currentAddress(customer), ...saved.filter((address) => address.id !== 'current')]
    setAddresses(options)
    setSelectedId(options[0]?.id || 'current')
  }, [router.pathname, customer])

  if (router.pathname !== '/checkout' || !customer) return null
  const selected = addresses.find((address) => address.id === selectedId) || addresses[0]

  function choose(id: string) {
    setSelectedId(id)
    window.dispatchEvent(new CustomEvent('alpha-address-selected', { detail: id }))
  }

  function saveDraft() {
    if (!customer || !draft?.cep || !draft.address || !draft.number || !draft.city) return
    const saved = [...addresses.filter((address) => address.id !== 'current' && address.id !== draft.id), draft]
    localStorage.setItem(`alpha-addresses-${customer.id}`, JSON.stringify(saved))
    setAddresses([addresses[0], ...saved])
    setEditing(false)
    choose(draft.id)
    setDraft(null)
  }

  return <section className="checkout-address-selector" aria-label="Endereço de entrega">
    <div className="checkout-address-heading"><div><p className="eyebrow">ENTREGA</p><h2>Escolha um endereço de entrega</h2></div><button type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Fechar' : 'Editar'}</button></div>
    {selected && <div className="checkout-address-current"><span className="address-radio" aria-hidden="true">{selected.id === selectedId ? '●' : '○'}</span><div><strong>{selected.label}</strong><p>{selected.address}, {selected.number}{selected.complement ? ` - ${selected.complement}` : ''}</p><small>CEP: {selected.cep} - {selected.city}</small></div></div>}
    {editing && <div className="checkout-address-editor"><label>Endereço salvo<select value={selectedId} onChange={(event) => choose(event.target.value)}>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} - {address.address}, {address.number}</option>)}</select></label><button type="button" className="address-add-button" onClick={() => setDraft({ id: `address-${Date.now()}`, label: 'Novo endereço', cep: '', address: '', number: '', complement: '', city: '' })}>Adicionar novo endereço</button>{draft && <div className="checkout-new-address"><label>Identificação<input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label><label>CEP<input value={draft.cep} onChange={(event) => setDraft({ ...draft, cep: formatCep(event.target.value) })} /></label><label>Endereço<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label><label>Número<input value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} /></label><label>Complemento<input value={draft.complement} onChange={(event) => setDraft({ ...draft, complement: event.target.value })} /></label><label>Cidade / UF<input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></label><button type="button" className="primary-button" onClick={saveDraft}>Salvar endereço</button></div>}</div>}
  </section>
}
