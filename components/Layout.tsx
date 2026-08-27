import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <div className="top-strip">ENVIO PARA TODO O BRASIL <span>•</span> ATENDIMENTO TÉCNICO ESPECIALIZADO</div>
      <header className="site-header">
        <div className="header-main container">
          <Link href="/" className="brand" aria-label="Alpha Tec página inicial">
            <img src="/logo.png.jpg" alt="Alpha Tec - Peças e acessórios" />
          </Link>
          <form className="search-box" action="/products">
            <input name="q" placeholder="Busque por peça, modelo ou categoria" aria-label="Buscar produtos" />
            <button type="submit" aria-label="Buscar">Buscar</button>
          </form>
          <div className="header-actions">
            <Link href="/products">Minha conta</Link>
            <Link href="/products" className="cart-link">Carrinho <span>0</span></Link>
          </div>
        </div>
        <nav className="category-nav">
          <div className="container nav-inner">
            <Link href="/products">Todas as peças</Link>
            <Link href="/products?category=esteiras">Esteiras</Link>
            <Link href="/products?category=musculacao">Musculação</Link>
            <Link href="/products?category=bicicletas">Bicicletas</Link>
            <Link href="/products?category=acessorios">Acessórios</Link>
            <Link href="/products?category=ofertas" className="sale-link">Ofertas</Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer"><div className="container"><strong>ALPHA TEC</strong><span>Peças que mantêm seu treino em movimento.</span></div></footer>
    </div>
  )
}
