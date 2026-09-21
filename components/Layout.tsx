import CheckoutAddressSelector from './CheckoutAddressSelector'
import NotificationBell from './NotificationBell'
import CustomerMenu from './CustomerMenu'
import Link from 'next/link'
import { useCart } from './CartContext'
import { useCustomer } from './CustomerContext'

const productCategories = [
  { label: 'Esteiras', slug: 'esteiras', image: 'https://www.movement.com.br/wp-content/uploads/2025/04/iTouch-Cinza-2.png' },
  { label: 'Musculação', slug: 'musculacao', image: 'https://images.unsplash.com/photo-1646656130630-07af3a262a9b?auto=format&fit=crop&w=240&q=75' },
  { label: 'Bicicletas', slug: 'bicicletas', image: 'https://images.unsplash.com/photo-1707985287164-c84627ad6eba?auto=format&fit=crop&w=240&q=75' },
  { label: 'Elípticos', slug: 'elipticos', image: 'https://www.movement.com.br/wp-content/uploads/2025/08/categ-elipticos-2025.png' },
  { label: 'Acessórios', slug: 'acessorios', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=240&q=75' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { count } = useCart()
  const { customer } = useCustomer()
  return (
    <div className="site-shell">
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
            <Link href="/products" className="nav-utility-link">Todas as peças</Link>
            {productCategories.map((category) => (
              <Link href={`/products?category=${category.slug}`} className="category-nav-link" key={category.slug}>
                <img src={category.image} alt="" />
                <span>{category.label}</span>
              </Link>
            ))}
            <Link href="/products?category=ofertas" className="nav-utility-link sale-link">Ofertas</Link>
            <Link href="/maintenance" className="nav-utility-link">Manutenção</Link>
          </div>
        </nav>
      </header>
      <main><CheckoutAddressSelector />{children}</main>
      <footer className="site-footer"><div className="container"><strong>ALPHA TEC</strong><span>Peças que mantêm seu treino em movimento.</span><nav className="footer-links" aria-label="Links institucionais"><Link href="/privacidade">Privacidade</Link><Link href="/admin">Acesso administrativo</Link></nav></div></footer>
    </div>
  )
}
