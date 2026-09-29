import Head from 'next/head'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-mesh px-4 py-16 text-slate-200">
      <Head>
        <title>Términos | Webycitas</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <article className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-white">Términos</h1>
        <p>
          La maqueta que se publica tras el formulario es un preview no reclamado. No crea cuenta de
          planilla ni obliga a contratar.
        </p>
        <p>
          <Link href="/" className="text-brand-300 underline-offset-2 hover:underline">
            Volver
          </Link>
        </p>
      </article>
    </div>
  )
}
