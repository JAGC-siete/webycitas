import type { AppProps } from 'next/app'
import localFont from 'next/font/local'
import AuthHashRedirect from '../components/auth/AuthHashRedirect'
import IdleSessionWarning from '../components/auth/IdleSessionWarning'
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

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={cn(montserrat.variable, 'min-h-screen font-sans')}>
      <AuthHashRedirect />
      <IdleSessionWarning />
      <Component {...pageProps} />
    </div>
  )
}
