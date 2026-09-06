import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCustomer } from './CustomerContext'

export default function CustomerMenu() {
  const { customer } = useCustomer()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  if (!customer) return null

  return <div className={`customer-menu ${open ? 'open' : ''}`} ref={menuRef}>
    <button type="button" className="customer-menu-trigger" aria-label={`Menu de ${customer.name}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {customer.name}
    </button>
    <nav className="customer-menu-panel" aria-label="Menu da conta">
      <Link href="/account#orders">Compras</Link>
      <Link href="/account">Histórico</Link>
      <Link href="/maintenance">Perguntas</Link>
      <Link href="/account#reviews">Opiniões</Link>
    </nav>
  </div>
}
