import { FormEvent, useEffect, useState } from 'react'

type StoreProfile = {
  cnpj: string
  legalName: string
  tradeName: string
  email: string
  phone: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

const emptyProfile: StoreProfile = { cnpj: '', legalName: '', tradeName: '', email: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '' }

export default function AdminStoreProfile() {
  const [profile, setProfile] = useState<StoreProfile>(emptyProfile)
  const [message, setMessage] = useState('')
  const [loadingCnpj, setLoadingCnpj] = useState(false)

  useEffect(() => {
    fetch('/api/store-profile')
      .then(async (response) => response.ok ? response.json() : Promise.reject(await response.json()))
      .then((data) => data && setProfile({ ...emptyProfile, ...data }))
      .catch((error) => setMessage(error?.error || 'Não foi possível carregar o cadastro da loja.'))
  }, [])

  function update(field: keyof StoreProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  async function lookupCnpj() {
    const cnpj = profile.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) return setMessage('Informe um CNPJ com 14 números.')

    setLoadingCnpj(true)
    setMessage('Consultando CNPJ...')
    try {
      const response = await fetch(`/api/store-profile?cnpj=${cnpj}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProfile((current) => ({ ...current, ...result, cnpj }))
      setMessage('Dados preenchidos pela consulta do CNPJ. Confira e complete o número do endereço, se necessário.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o CNPJ.')
    } finally {
      setLoadingCnpj(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/store-profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    const result = await response.json()
    if (!response.ok) return setMessage(result.error || 'Não foi possível salvar os dados da loja.')
    setProfile({ ...emptyProfile, ...result })
    setMessage('Cadastro da loja salvo. O CEP de origem está pronto para integrações de frete.')
  }

  return <section className="admin-page"><div className="admin-heading"><div><p className="eyebrow">ÁREA MASTER</p><h2>Cadastro da loja</h2></div></div><form className="admin-form" onSubmit={save}><div className="form-grid"><label>CNPJ<input required value={profile.cnpj} onChange={(event) => update('cnpj', event.target.value)} placeholder="00.000.000/0000-00" /></label><div className="form-action"><button className="outline-button" type="button" onClick={lookupCnpj} disabled={loadingCnpj}>{loadingCnpj ? 'Consultando...' : 'Consultar CNPJ'}</button></div><label>Razão social<input required value={profile.legalName} onChange={(event) => update('legalName', event.target.value)} /></label><label>Nome fantasia<input value={profile.tradeName} onChange={(event) => update('tradeName', event.target.value)} /></label><label>E-mail<input type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} /></label><label>Telefone<input value={profile.phone} onChange={(event) => update('phone', event.target.value)} /></label><label>CEP de origem<input required value={profile.cep} onChange={(event) => update('cep', event.target.value)} placeholder="00000-000" /></label><label>Endereço<input required value={profile.street} onChange={(event) => update('street', event.target.value)} /></label><label>Número<input required value={profile.number} onChange={(event) => update('number', event.target.value)} /></label><label>Bairro<input value={profile.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} /></label><label>Cidade<input required value={profile.city} onChange={(event) => update('city', event.target.value)} /></label><label>UF<input required maxLength={2} value={profile.state} onChange={(event) => update('state', event.target.value.toUpperCase())} /></label></div>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit">Salvar cadastro <span>→</span></button></form></section>
}