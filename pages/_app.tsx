import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { CartProvider } from '../components/CartContext'
import { CustomerProvider } from '../components/CustomerContext'
import { ErrorBoundary } from '../components/ErrorBoundary'
import CookieConsent from '../components/CookieConsent'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isAdminRoute = router.pathname === '/admin' || router.pathname.startsWith('/admin/')

  return (
    <ErrorBoundary>
      {isAdminRoute ? <>
        <Head><title>Painel Master | Alpha Tec</title><meta name="robots" content="noindex,nofollow" /></Head>
        <Component {...pageProps} />
      </> : <CustomerProvider>
        <CartProvider>
          <Layout><Component {...pageProps} /></Layout>
          <CookieConsent />
        </CartProvider>
      </CustomerProvider>}
    </ErrorBoundary>
  )
}
