import CheckoutAddressSelector from './CheckoutAddressSelector'
import NotificationBell from './NotificationBell'
import CustomerMenu from './CustomerMenu'
import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCart } from './CartContext'
import { useCustomer } from './CustomerContext'
import { getWhatsAppUrl, storeConfig } from '../lib/store-config'
import PaymentMethods from './PaymentMethods'
import FooterSecurity from './FooterSecurity'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')
const siteTitle = 'Alpha Tec | Peças para Esteira, Bicicleta, Elíptico e Musculação'
const siteDescription = 'Alpha Tec oferece peças, inversor Movement, acessórios e manutenção para esteiras, bicicletas, elipticos, musculação e equipamentos fitness com entrega para todo o Brasil.'
const supportMessage = 'Olá, preciso de ajuda para encontrar uma peça para meu equipamento fitness.'

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { count } = useCart()
  const { customer } = useCustomer()
  const whatsappUrl = getWhatsAppUrl(supportMessage)
  const supportHref = whatsappUrl || '/maintenance'
  const activeCategory = router.pathname === '/products' ? String(router.query.category || '') : ''
  const categoryClass = (category: string) => activeCategory === category ? 'active-category' : ''
  const categoryCurrent = (category: string) => activeCategory === category ? 'page' as const : undefined
  return (
    <div className="site-shell">
      <Head>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDescription} />
        <meta name="robots" content="index, follow" />
        <meta name="keywords" content="inversor Movement, inversor para esteira Movement, comprar inversor Movement, peças para esteira, peças para bicicleta, peças para academia, peças para eliptico, acessorios para academia, reposição de peças fitness, manutenção de esteira, manutenção de bike, rolete para esteira, correia para esteira, polia para musculação, peças e acessorios fitness, Alpha Tec" />
        <link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="theme-color" content="#202225" />
        <link rel="canonical" href={siteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Loja Alpha Tec" />
        <meta property="og:title" content={siteTitle} />
        <meta property="og:description" content={siteDescription} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={`${siteUrl}/logo-header-uniform.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Store',
              name: 'Loja Alpha Tec',
              alternateName: ['Alpha Tec', 'lojaalphatec', 'Alphatec Online'],
              url: siteUrl,
              logo: `${siteUrl}/logo-header-uniform.jpg`,
              description: siteDescription,
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'MAR MAX SCHRAMM Z92890, 2499',
                addressLocality: 'Florianopolis',
                addressRegion: 'SC',
                postalCode: '88095-000',
                addressCountry: 'BR',
              },
            }),
          }}
        />
      </Head>
      <div className="top-strip">ENVIO PARA TODO O BRASIL <span>•</span> ATENDIMENTO TÉCNICO ESPECIALIZADO</div>
      <header className="site-header">
        <div className="header-main container">
          <Link href="/" className="brand" aria-label="Alpha Tec página inicial">
            <img src="/logo-header-uniform.jpg" alt="Alpha Tec - Peças e acessórios" />
          </Link>
          <form className="search-box" action="/products">
            <input name="q" placeholder="Peça, código, marca ou modelo" aria-label="Buscar por nome, código, marca ou modelo do equipamento" />
            <button type="submit" aria-label="Buscar">Buscar</button>
          </form>
          <div className="header-actions">
            {customer ? <><CustomerMenu /><Link href="/cart" className="cart-link">Carrinho <span>{count}</span></Link><NotificationBell /></> : <><Link href="/account?mode=register">CRIAR CONTA</Link><span aria-hidden="true">/</span><Link href="/account?mode=login">LOGIN</Link><Link href="/cart" className="cart-link">Carrinho <span>{count}</span></Link></>}
          </div>
        </div>
        <nav className="category-nav">
          <div className="container nav-inner">
            <Link href="/products" className={categoryClass('')} aria-current={categoryCurrent('')}>Todas as peças</Link>
            <Link href="/products?category=esteiras" className={categoryClass('esteiras')} aria-current={categoryCurrent('esteiras')}>Esteiras</Link>
            <Link href="/products?category=musculacao" className={categoryClass('musculacao')} aria-current={categoryCurrent('musculacao')}>Musculação</Link>
            <Link href="/products?category=bicicletas" className={categoryClass('bicicletas')} aria-current={categoryCurrent('bicicletas')}>Bicicletas</Link>
            <Link href="/products?category=elipticos" className={categoryClass('elipticos')} aria-current={categoryCurrent('elipticos')}>Elípticos</Link>
            <Link href="/products?category=acessorios" className={categoryClass('acessorios')} aria-current={categoryCurrent('acessorios')}>Acessórios</Link>
            <Link href="/products?category=ofertas" className={`sale-link ${categoryClass('ofertas')}`} aria-current={categoryCurrent('ofertas')}>Ofertas</Link>
            <Link href={supportHref} target={whatsappUrl ? '_blank' : undefined} rel={whatsappUrl ? 'noopener noreferrer' : undefined} className="nav-service-callout">
              <span>Suporte técnico</span>
              <strong>Ajuda para encontrar sua peça?</strong>
              <b>{whatsappUrl ? 'Fale pelo WhatsApp' : 'Solicitar atendimento'} <i>→</i></b>
            </Link>
            <Link href={supportHref} target={whatsappUrl ? '_blank' : undefined} rel={whatsappUrl ? 'noopener noreferrer' : undefined} className="mobile-maintenance-link">{whatsappUrl ? 'WhatsApp técnico' : 'Suporte técnico'} <span>→</span></Link>
          </div>
        </nav>
      </header>
      <main>
        <CheckoutAddressSelector />
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <strong>ALPHA TEC</strong>
            <span>Peças e assistência técnica para equipamentos fitness.</span>
            <nav className="footer-links" aria-label="Links institucionais">
              <Link href="/account">Minha conta</Link>
              <Link href="/maintenance">Assistência técnica</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href={supportHref} target={whatsappUrl ? '_blank' : undefined} rel={whatsappUrl ? 'noopener noreferrer' : undefined}>{whatsappUrl ? 'WhatsApp técnico' : 'Suporte técnico'}</Link>
            </nav>
          </div>
          <nav className="footer-categories" aria-label="Categorias no rodapé">
            <h3>Peças por equipamento</h3>
            <Link href="/products?category=esteiras">Esteiras</Link>
            <Link href="/products?category=musculacao">Musculação</Link>
            <Link href="/products?category=bicicletas">Bicicletas</Link>
            <Link href="/products?category=elipticos">Elípticos</Link>
            <Link href="/products?category=acessorios">Acessórios</Link>
            <Link href="/products">Todas as peças</Link>
          </nav>
          <div className="footer-payment"><PaymentMethods /></div>
          <FooterSecurity https={siteUrl.startsWith('https://')} />
        </div>
        <div className="container footer-company">
          <div className="footer-legal">
            <strong>{storeConfig.legalName}</strong>
            <span>CNPJ: {storeConfig.document}</span>
            <address>
              {storeConfig.address.street}, {storeConfig.address.number} · {storeConfig.address.neighborhood}<br />
              {storeConfig.address.city}/{storeConfig.address.state} · CEP {storeConfig.address.cep}
            </address>
          </div>
        </div>
      </footer>
    </div>
  )
}
