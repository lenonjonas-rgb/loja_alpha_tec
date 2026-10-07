export default function PaymentMethods({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`payment-trust${compact ? ' payment-trust-compact' : ''}`}>
      <div className="payment-trust-copy">
        <h3>Formas de pagamento</h3>
        {!compact && <p>Escolha Pix ou cartão de crédito ao finalizar seu pedido.</p>}
      </div>
      <ul className="payment-trust-methods" aria-label="Formas de pagamento disponíveis no checkout">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m12 2 10 10-10 10L2 12Z" />
            <path d="m7 7 5 5 5-5M7 17l5-5 5 5" />
          </svg>
          <span>Pix</span>
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <path d="M2 10h20M6 15h4" />
          </svg>
          <span>Cartão de crédito</span>
        </li>
      </ul>
      {!compact && <small>A aprovação e as condições de pagamento são informadas no checkout. O pedido é confirmado após a aprovação.</small>}
    </div>
  )
}
