import type { GetServerSideProps } from 'next'
import { products } from '../lib/products'

const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')
const routes = ['/', '/products', '/maintenance', '/perguntas', '/opinioes', '/privacidade']
const categoryRoutes = ['esteiras', 'musculacao', 'bicicletas', 'elipticos', 'acessorios', 'ofertas']

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const lastmod = new Date().toISOString()
  const productUrls = Array.isArray(products)
    ? products
        .filter((product) => product && product.active !== false)
        .map((product) => `  <url>\n    <loc>${siteUrl}/products/${encodeURIComponent(String(product.id))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
        .join('\n')
    : ''

  const categoryUrls = categoryRoutes
    .map((route) => `  <url>\n    <loc>${siteUrl}/products?category=${encodeURIComponent(route)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n')

  const urls = [...routes, ...categoryRoutes.map((route) => `/products?category=${route}`)]
    .map((route) => `  <url>\n    <loc>${siteUrl}${route.startsWith('/') ? route : `/${route}`}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n')

  res.setHeader('Content-Type', 'application/xml')
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n${categoryUrls}\n${productUrls}\n</urlset>\n`)
  res.end()

  return { props: {} }
}

export default function SitemapXml() {
  return null
}