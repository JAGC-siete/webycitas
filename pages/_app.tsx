import type { AppProps } from 'next/app'
import Head from 'next/head'
import localFont from 'next/font/local'
import AuthHashRedirect from '../components/auth/AuthHashRedirect'
import IdleSessionWarning from '../components/auth/IdleSessionWarning'
import SessionIdleGuard from '../components/mercado/SessionIdleGuard'
import { isMercadoPublicPath } from '../lib/product-surfaces'
import { cn } from '../lib/utils'
import '../styles/globals.css'
import '../styles/landing-liquid.css'

/** Self-hosted: next/font/google falla en builds Docker sin acceso a fonts.googleapis.com. */
const montserrat = localFont({
  src: '../public/fonts/montserrat/montserrat-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-montserrat',
})

export default function App({ Component, pageProps, router }: AppProps) {
  // router.pathname is the page file route, so directory pages keep their internal prefix here.
  const directory = isMercadoPublicPath(router.pathname)

  return (
    <div className={cn(montserrat.variable, 'min-h-screen font-sans')}>
      <Head>
        {/* Keyed so a client site with its own icon (meta.iconUrl) replaces it instead of adding a second one. */}
        <link rel="icon" href="/favicon.ico" sizes="any" key="icon" />
      </Head>
      {directory ? (
        <SessionIdleGuard />
      ) : (
        <>
          <AuthHashRedirect />
          <IdleSessionWarning />
        </>
      )}
      <Component {...pageProps} />
    </div>
  )
}
