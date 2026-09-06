import { useEffect, useState } from 'react'

type AdminQuestion = { id: string; product_id: string; productName: string; customerName: string; customerEmail: string; question: string; answer: string | null; answered_at: string | null; created_at: string }

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminQuestions({ onMessage }: { onMessage: (message: string) => void }) {
  const [questions, setQuestions] = useState<AdminQuestion[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/questions-admin')
      if (response.ok) setQuestions(await response.json())
    } finally {
      setLoading(false)
    }
  }

  async function answer(id: string) {
    const text = (drafts[id] || '').trim()
    if (!text) return onMessage('Escreva a resposta antes de enviar.')
    const response = await fetch('/api/questions-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, answer: text }) })
    const result = await response.json()
    if (!response.ok) return onMessage(result.error || 'Não foi possível salvar a resposta.')
    setDrafts((current) => ({ ...current, [id]: '' }))
    onMessage('Resposta publicada e cliente notificado.')
    void load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/questions-admin?id=${id}`, { method: 'DELETE' })
    if (!response.ok) return onMessage('Não foi possível excluir a pergunta.')
    onMessage('Pergunta excluída.')
    void load()
  }

  const visible = filter === 'pending' ? questions.filter((item) => !item.answer) : questions
  const pendingCount = questions.filter((item) => !item.answer).length

  return <div className="admin-panel">
    <div className="admin-tabs">
      <button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Sem resposta ({pendingCount})</button>
      <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas ({questions.length})</button>
    </div>

    {loading && <p className="form-hint">Carregando perguntas...</p>}
    {!loading && !visible.length && <p className="form-hint">Nenhuma pergunta {filter === 'pending' ? 'aguardando resposta' : 'registrada'}.</p>}

    <ul className="product-question-list">
      {visible.map((item) => (
        <li key={item.id}>
          <strong>{item.productName}</strong>
          <small className="cart-muted"> — {item.customerName} ({item.customerEmail}) em {formatDate(item.created_at)}</small>
          <p className="product-question-text">{item.question}</p>
          {item.answer && <p className="product-question-answer">{item.answer}</p>}
          <label>
            {item.answer ? 'Editar resposta' : 'Responder'}
            <textarea
              rows={3}
              maxLength={1000}
              value={drafts[item.id] ?? (item.answer || '')}
              onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
            />
          </label>
          <button className="primary-button" type="button" onClick={() => answer(item.id)}>Publicar resposta <span>→</span></button>{' '}
          <button className="outline-button" type="button" onClick={() => remove(item.id)}>Excluir</button>
        </li>
      ))}
    </ul>
  </div>
}
