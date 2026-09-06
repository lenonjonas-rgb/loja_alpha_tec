import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'

type SearchEntry = { id: string; term: string; created_at: string }

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Historico() {
  const router = useRouter()
  const { customer } = useCustomer()
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=historico') }, [customer, router])

  useEffect(() => { if (customer) void load() }, [customer])

  async function getToken() {
    if (!supabase) return ''
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || ''
  }

  async function load() {
    const token = await getToken()
    if (!token) return setLoading(false)
    try {
      const response = await fetch('/api/search-history', { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) setEntries(await response.json())
    } finally {
      setLoading(false)
    }
  }

  async function remove(id?: string) {
    const token = await getToken()
    if (!token) return
    await fetch(`/api/search-history${id ? `?id=${id}` : ''}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setEntries((current) => (id ? current.filter((item) => item.id !== id) : []))
  }

  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1></section>

  return <section className="container checkout-page">
    <p className="eyebrow">MINHA CONTA</p>
    <h1>Histórico de buscas</h1>
    <p className="cart-muted">Estas são as buscas que você fez na loja. Clique em uma delas para ver os resultados novamente.</p>

    {loading && <p className="cart-muted">Carregando seu histórico...</p>}
    {!loading && !entries.length && <p className="cart-muted">Você ainda não fez nenhuma busca. <Link href="/products">Ver catálogo →</Link></p>}

    {entries.length > 0 && <>
      <button className="outline-button" type="button" onClick={() => remove()}>Limpar histórico</button>
      <ul className="history-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link href={`/products?q=${encodeURIComponent(entry.term)}`}>{entry.term}</Link>
            <small className="cart-muted">{formatDate(entry.created_at)}</small>
            <button type="button" aria-label={`Remover ${entry.term}`} onClick={() => remove(entry.id)}>×</button>
          </li>
        ))}
      </ul>
    </>}
  </section>
}
