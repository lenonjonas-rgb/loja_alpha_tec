import { FormEvent, useState } from 'react'
import Link from 'next/link'

export default function PasswordReset() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [requested, setRequested] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/password-reset-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível solicitar o código.')
      setRequested(true)
      setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível solicitar o código.')
    } finally {
      setSubmitting(false)
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault()
    if (password !== passwordConfirmation) return setMessage('A confirmação de senha não confere.')
    setSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/password-reset-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível redefinir a senha.')
      setMessage(result.message)
      setCode('')
      setPassword('')
      setPasswordConfirmation('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="container account-page"><p className="eyebrow">ACESSO SEGURO</p><h1>Recuperar senha</h1><p className="account-copy">Informe o e-mail cadastrado para receber um código de recuperação.</p>{!requested ? <form className="account-form password-reset-form" onSubmit={requestCode}><label className="wide">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar código'} <span>→</span></button></form> : <form className="account-form password-reset-form" onSubmit={resetPassword}><p className="form-hint wide">Confira sua caixa de entrada e o spam. O código é válido por 15 minutos.</p><label className="wide">Código de recuperação<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label><label className="wide">Nova senha<input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="wide">Confirmar nova senha<input required type="password" minLength={6} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Definir nova senha'} <span>→</span></button><button className="account-switch" type="button" onClick={() => { setRequested(false); setMessage('') }}>Enviar outro código</button></form>}<Link href="/account?mode=login" className="account-switch">Voltar para o login</Link></section>
}
