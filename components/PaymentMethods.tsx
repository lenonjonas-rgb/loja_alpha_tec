const cardBrands = [
  { name: 'Visa', image: 'visa' },
  { name: 'Mastercard', image: 'mastercard' },
  { name: 'Elo', image: 'elo' },
  { name: 'American Express', image: 'amex' },
]

export default function PaymentMethods() {
  return (
    <div className="footer-payment-methods">
      <h3>Pague com</h3>
      <p className="footer-payment-label">Cartões de crédito</p>
      <ul className="footer-card-brands" aria-label="Bandeiras de cartão disponíveis no checkout">
        {cardBrands.map((brand) => (
          <li key={brand.image}><img src={`/payment-brands/${brand.image}.png`} alt={brand.name} width={64} height={40} loading="lazy" /></li>
        ))}
      </ul>
      <ul className="payment-trust-methods" aria-label="Formas de pagamento disponíveis no checkout">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m12 2 10 10-10 10L2 12Z" />
            <path d="m7 7 5 5 5-5M7 17l5-5 5 5" />
          </svg>
          <span>Pix</span>
        </li>
      </ul>
    </div>
  )
}
