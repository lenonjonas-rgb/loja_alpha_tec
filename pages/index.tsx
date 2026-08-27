import Link from 'next/link'

const categories = [
  { title: 'Esteiras', detail: 'Correias, roletes e placas', image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=800&q=80' },
  { title: 'Musculação', detail: 'Cabos, polias e estruturas', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80' },
  { title: 'Bicicletas', detail: 'Pedais, correias e sensores', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80' },
  { title: 'Acessórios', detail: 'Manoplas, parafusos e mais', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80' },
]

const products = [
  { id: '1', name: 'Rolamento para esteira', price: 'R$ 49,90', oldPrice: 'R$ 59,90', image: 'https://images.unsplash.com/photo-1597452485677-d661dfd0434d?auto=format&fit=crop&w=700&q=80' },
  { id: '2', name: 'Cabo de aço para crossover', price: 'R$ 89,90', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=700&q=80' },
  { id: '3', name: 'Pedal universal para bike', price: 'R$ 39,90', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80' },
]

export default function Home() {
  return <>
    <section className="hero container"><div className="hero-copy"><p className="eyebrow">MANUTENÇÃO SEM PARAR</p><h1>Seu equipamento.<br /><em>Nosso compromisso.</em></h1><p>Peças e acessórios para manter sua academia sempre pronta para o próximo treino.</p><Link href="/products" className="primary-button">Explorar peças <span>→</span></Link></div><div className="hero-image"><span className="hero-label">PERFORMANCE<br /><b>EM CADA DETALHE</b></span></div></section>
    <section className="trust-bar"><div className="container trust-grid"><div><b>Entrega para todo Brasil</b><span>Envio rápido e seguro</span></div><div><b>Compra protegida</b><span>Seus dados sempre seguros</span></div><div><b>Suporte especializado</b><span>Fale com quem entende</span></div><div><b>Peças de qualidade</b><span>Para você treinar tranquilo</span></div></div></section>
    <section className="container content-section"><div className="section-heading"><div><p className="eyebrow">ENCONTRE O QUE PRECISA</p><h2>Compre por categoria</h2></div><Link href="/products">Ver todas <span>→</span></Link></div><div className="category-grid">{categories.map((category) => <Link className="category-card" href={`/products?category=${category.title.toLowerCase()}`} key={category.title}><img src={category.image} alt="" /><div><h3>{category.title}</h3><p>{category.detail}</p><span>Ver peças →</span></div></Link>)}</div></section>
    <section className="featured-band"><div className="container"><div className="section-heading light"><div><p className="eyebrow">SELEÇÃO ALPHA TEC</p><h2>Mais procurados</h2></div><Link href="/products">Ver catálogo <span>→</span></Link></div><div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><Link href={`/products/${product.id}`} className="product-image"><img src={product.image} alt="" />{product.oldPrice && <b>OFERTA</b>}</Link><div className="product-info"><p>ALPHA TEC</p><h3>{product.name}</h3><div>{product.oldPrice && <del>{product.oldPrice}</del>}<strong>{product.price}</strong></div><Link href={`/products/${product.id}`} className="product-button">Ver produto</Link></div></article>)}</div></div></section>
    <section className="container service-callout"><div><p className="eyebrow">PRECISA DE AJUDA?</p><h2>Manutenção para o seu equipamento?</h2><p>Escolha entre visita sazonal ou contrato mensal e verifique a cobertura para seu endereço.</p></div><Link href="/maintenance" className="outline-button">Quero manutenção <span>→</span></Link></section>
  </>
}
