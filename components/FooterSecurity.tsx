export default function FooterSecurity({ https }: { https: boolean }) {
  return (
    <section className="footer-security" aria-labelledby="footer-security-title">
      <h3 id="footer-security-title">Segurança</h3>
      <div className="footer-security-badges">
        {https && (
          <div className="footer-security-badge">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M16 3 27 7v8c0 7-6 12-11 14C11 27 5 22 5 15V7Z" />
              <rect x="11" y="13" width="10" height="8" rx="2" />
              <path d="M13 13v-3a3 3 0 0 1 6 0v3" />
            </svg>
            <div><strong>Conexão HTTPS</strong><span>Dados criptografados em trânsito</span></div>
          </div>
        )}
        <div className="footer-security-badge">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="7" width="26" height="18" rx="3" />
            <path d="M3 13h26m-17 6 3 3 6-6" />
          </svg>
          <div><strong>Mercado Pago</strong><span>Processamento de Pix e cartão</span></div>
        </div>
      </div>
    </section>
  )
}
