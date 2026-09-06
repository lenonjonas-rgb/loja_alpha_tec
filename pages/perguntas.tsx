import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useCustomer } from '../components/CustomerContext'
import { supabase } from '../lib/supabase'

type CustomerQuestion = { id: string; product_id: string; productName: string; question: string; answer: string | null; answered_at: string | null; created_at: string }

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Perguntas() {
  const router = useRouter()
  const { customer } = useCustomer()
  const [questions, setQuestions] = useState<CustomerQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!customer && router.isReady) router.replace('/account?returnTo=perguntas') }, [customer, router])

  useEffect(() => {
    async function load() {
      if (!supabase || !customer) return
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) return setLoading(false)
      try {
        const response = await fetch('/api/questions?mine=1', { headers: { Authorization: `Bearer ${token}` } })
        if (response.ok) setQuestions(await response.json())
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [customer])

  if (!customer) return <section className="container checkout-page"><h1>Entrando na sua conta...</h1></section>

  return <section className="container checkout-page">
    <p className="eyebrow">MINHA CONTA</p>
    <h1>Perguntas</h1>
    <p className="cart-muted">Acompanhe aqui as perguntas que você enviou sobre os produtos e as respostas da nossa equipe.</p>

    {loading && <p className="cart-muted">Carregando suas perguntas...</p>}
    {!loading && !questions.length && <p className="cart-muted">Você ainda não fez perguntas. <Link href="/products">Ver catálogo →</Link></p>}

    <ul className="product-question-list">
      {questions.map((item) => (
        <li key={item.id}>
          <Link href={`/products/${item.product_id}`} className="product-question-product">{item.productName}</Link>
          <p className="product-question-text">{item.question}</p>
          <small className="cart-muted">Enviada em {formatDate(item.created_at)}</small>
          {item.answer
            ? <p className="product-question-answer">{item.answer}</p>
            : <p className="cart-muted">Aguardando resposta da loja.</p>}
        </li>
      ))}
    </ul>
  </section>
}
