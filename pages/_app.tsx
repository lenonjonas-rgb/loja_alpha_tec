import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Layout from '../components/Layout'
import { CartProvider } from '../components/CartContext'
import { CustomerProvider } from '../components/CustomerContext'
import { ErrorBoundary } from '../components/ErrorBoundary'
import CookieConsent from '../components/CookieConsent'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <CustomerProvider>
        <CartProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
          <CookieConsent />
        </CartProvider>
      </CustomerProvider>
    </ErrorBoundary>
  )
}
