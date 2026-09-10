/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
    }, {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://http2.mlstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://secure-fields.mercadopago.com https://api-static.mercadopago.com https://viacep.com.br https://nominatim.openstreetmap.org https://http2.mlstatic.com https://www.mercadolibre.com https://api.mercadolibre.com; frame-src 'self' https://*.mercadopago.com https://*.supabase.co https://*.mercadolibre.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
        ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    }]
  },
}

module.exports = nextConfig
