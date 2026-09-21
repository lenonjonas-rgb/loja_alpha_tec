import type { GetServerSideProps } from 'next'

const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://lojaalphatec.com.br').replace(/\/$/, '')
const routes = ['/', '/products', '/maintenance', '/perguntas', '/opinioes', '/privacidade']

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const lastmod = new Date().toISOString()
  const urls = routes
    .map((route) => `  <url>\n    <loc>${siteUrl}${route}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n')

  res.setHeader('Content-Type', 'application/xml')
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  res.end()

  return { props: {} }
}

export default function SitemapXml() {
  return null
}