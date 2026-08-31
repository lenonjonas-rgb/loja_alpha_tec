import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCustomer, type Customer } from '../components/CustomerContext'
import { getProviders, signIn as signInGoogle, useSession } from 'next-auth/react'
import { supabase } from '../lib/supabase'
import CustomerOrders from '../components/CustomerOrders'

type AccountForm = Customer
const emptyCustomer: AccountForm = { name: '', document: '', email: '', phone: '', cep: '', address: '', number: '', complement: '', city: '' }

export default function Account() {
  const router = useRouter()
  const { customer, signOut } = useCustomer()
  const { data: socialSession } = useSession()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState<AccountForm>(emptyCustomer)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (!router.isReady) return
    setMode(router.query.mode === 'register' ? 'register' : 'login')
    setPassword('')
    setPasswordConfirmation('')
    setMessage('')
  }, [router.isReady, router.query.mode])
  useEffect(() => { const user = socialSession?.user; if (user && !customer) setForm((current) => ({ ...current, name: user.name || '', email: user.email || '' })) }, [socialSession, customer])
  function update(field: keyof AccountForm, value: string) { setForm((current) => ({ ...current, [field]: value })) }
  async function lookupCep(value: string) { const cep = value.replace(/\D/g, ''); update('cep', value); if (cep.length !== 8) { update('address', ''); update('city', ''); return } setMessage('Consultando endereço...'); try { const response = await fetch(`/api/cep?cep=${cep}`); const result = await response.json(); if (!response.ok) throw new Error(result.error); update('address', result.address.logradouro || ''); update('city', result.address.localidade ? `${result.address.localidade}/${result.address.uf || ''}` : ''); setMessage('Endereço preenchido. Informe o número e o complemento, se houver.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.') } }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    if (mode === 'register') {
      if (password !== passwordConfirmation) {
        setSubmitting(false)
        setMessage('A confirmação de senha não confere.')
        return
      }

      try {
        const response = await fetch('/api/customers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, password })
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Não foi possível criar seu cadastro.')
        setMessage('Cadastro criado com sucesso. Entre com seu e-mail para acessar a conta.')
        setMode('login')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível criar seu cadastro.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!supabase) {
      setSubmitting(false)
      setMessage('Supabase não está configurado.')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password })
    setSubmitting(false)
    if (error) setMessage('E-mail ou senha inválidos.')
  }
  async function continueWithGoogle() { const providers = await getProviders(); if (!providers?.google) return setMessage('Login com Google ainda não foi configurado.'); await signInGoogle('google', { callbackUrl: '/account' }) }
  if (customer) return <section className="container account-page"><p className="eyebrow">ÁREA DO CLIENTE</p><h1>Olá, {customer.name}</h1><p className="account-copy">Sua conta está pronta para agilizar compras e entregas.</p><div className="account-box"><h2>Dados cadastrados</h2><p><strong>E-mail:</strong> {customer.email}</p><p><strong>Entrega:</strong> {customer.address}, {customer.number}{customer.complement ? ` - ${customer.complement}` : ''} - {customer.city} | CEP {customer.cep}</p><button className="outline-button" onClick={signOut} type="button">Sair da conta</button></div><CustomerOrders /><Link href="/products" className="primary-button">Continuar comprando <span>→</span></Link></section>
  return <section className="container account-page"><p className="eyebrow">COMPRA SEGURA</p><h1>{mode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta'}</h1><div className="account-mode-tabs"><button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setPassword(''); setPasswordConfirmation(''); setMessage('') }}>Entrar</button><button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => { setMode('register'); setPassword(''); setPasswordConfirmation(''); setMessage('') }}>Criar conta</button></div><p className="account-copy">{mode === 'login' ? 'Use o e-mail e a senha cadastrados para acessar sua conta e acompanhar seus pedidos.' : 'Crie seu cadastro uma vez para comprar e acompanhar seus pedidos.'}</p><button className="google-button" type="button" onClick={continueWithGoogle}>{mode === 'login' ? 'Entrar com Google' : 'Criar conta com Google'}</button><div className="account-divider">ou use seu e-mail</div><form className="account-form" onSubmit={submit}>{mode === 'register' && <><label>Nome completo<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label>CPF ou CNPJ<input required value={form.document} onChange={(event) => update('document', event.target.value)} /></label><label>Telefone<input required value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label><label>CEP<input required value={form.cep} onChange={(event) => lookupCep(event.target.value)} placeholder="00000-000" /></label><label>Endereço<input required readOnly value={form.address} placeholder="Preenchido pelo CEP" /></label><label>Número<input required value={form.number} onChange={(event) => update('number', event.target.value)} /></label><label>Complemento<input value={form.complement} onChange={(event) => update('complement', event.target.value)} placeholder="Ex.: ap. 33, bloco 12" /></label><label>Cidade / UF<input required readOnly value={form.city} placeholder="Preenchida pelo CEP" /></label></>}<label className="wide">E-mail<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label className="wide">Senha<input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" /></label>{mode === 'register' && <label className="wide">Confirmar senha<input required type="password" minLength={6} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Digite a senha novamente" /></label>}{message && <p className="form-status">{message}</p>}<button className="primary-button" type="submit">{mode === 'register' ? 'Criar cadastro' : 'Entrar'} <span>→</span></button></form></section>
}
