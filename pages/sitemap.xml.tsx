import type { GetServerSideProps } from 'next'
import { products } from '../lib/products'
import { getSupabaseServer } from '../lib/supabase-server'

const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')
const routes = ['/', '/products', '/maintenance', '/perguntas', '/opinioes', '/privacidade']
const categoryRoutes = ['esteiras', 'musculacao', 'bicicletas', 'elipticos', 'acessorios', 'ofertas']

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const supabase = getSupabaseServer()
  const catalog = new Map((products || []).map((product) => [String(product.id), product.active !== false]))
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('products').select('id,active')
      .order('id').range(offset, offset + 999)
    if (error) {
      console.error('Falha ao carregar produtos para o sitemap:', error)
      res.statusCode = 503
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Sitemap temporariamente indisponivel.')
      return { props: {} }
    }
    for (const product of data || []) catalog.set(String(product.id), product.active === true)
    if (!data || data.length < 1000) break
  }

  const urls = [...new Set([
    ...routes,
    ...categoryRoutes.map((route) => `/products?category=${route}`),
    ...Array.from(catalog).filter(([, active]) => active).map(([id]) => `/products/${encodeURIComponent(id)}`),
  ])]
    .map((route) => `  <url>\n    <loc>${`${siteUrl}${route}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')}</loc>\n  </url>`)
    .join('\n')

  res.setHeader('Content-Type', 'application/xml')
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  res.end()

  return { props: {} }
}

export default function SitemapXml() {
  return null
}