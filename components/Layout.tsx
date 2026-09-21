import CheckoutAddressSelector from './CheckoutAddressSelector'
import NotificationBell from './NotificationBell'
import CustomerMenu from './CustomerMenu'
import Link from 'next/link'
import Head from 'next/head'
import { useCart } from './CartContext'
import { useCustomer } from './CustomerContext'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')
const siteTitle = 'Alpha Tec | Peças para Esteira, Bicicleta, Elíptico e Musculação'
const siteDescription = 'Alpha Tec oferece peças, acessórios e manutenção para esteiras, bicicletas, elipticos, musculação e equipamentos fitness com entrega para todo o Brasil.'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { count } = useCart()
  const { customer } = useCustomer()
  return (
    <div className="site-shell">
      <Head>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDescription} />
        <meta name="robots" content="index, follow" />
        <meta name="keywords" content="peças para esteira, peças para bicicleta, peças para academia, peças para eliptico, acessorios para academia, reposição de peças fitness, manutenção de esteira, manutenção de bike, rolete para esteira, correia para esteira, polia para musculação, peçase acessorios fitness, Alpha Tec" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/logo-header-uniform.jpg" />
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
            <input name="q" placeholder="Busque por peça, modelo ou categoria" aria-label="Buscar produtos" />
            <button type="submit" aria-label="Buscar">Buscar</button>
          </form>
          <div className="header-actions">
            {customer ? <><CustomerMenu /><Link href="/cart" className="cart-link">Carrinho <span>{count}</span></Link><NotificationBell /></> : <><Link href="/account?mode=register">CRIAR CONTA</Link><span aria-hidden="true">/</span><Link href="/account?mode=login">LOGIN</Link><Link href="/cart" className="cart-link">Carrinho <span>{count}</span></Link></>}
          </div>
        </div>
        <nav className="category-nav">
          <div className="container nav-inner">
            <Link href="/products">Todas as peças</Link>
            <Link href="/products?category=esteiras">Esteiras</Link>
            <Link href="/products?category=musculacao">Musculação</Link>
            <Link href="/products?category=bicicletas">Bicicletas</Link>
            <Link href="/products?category=elipticos">Elípticos</Link>
            <Link href="/products?category=acessorios">Acessórios</Link>
            <Link href="/products?category=ofertas" className="sale-link">Ofertas</Link>
            <Link href="/maintenance" className="nav-service-callout">
              <span>Precisa de ajuda?</span>
              <strong>Manutenção para o seu equipamento?</strong>
              <b>Quero manutenção <i>→</i></b>
            </Link>
          </div>
        </nav>
      </header>
      <main><CheckoutAddressSelector />{children}</main>
      <footer className="site-footer"><div className="container"><strong>ALPHA TEC</strong><span>Peças que mantêm seu treino em movimento.</span><nav className="footer-links" aria-label="Links institucionais"><Link href="/privacidade">Privacidade</Link><Link href="/admin">Acesso administrativo</Link></nav></div></footer>
    </div>
  )
}
