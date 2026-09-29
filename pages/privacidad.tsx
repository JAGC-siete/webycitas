import Head from 'next/head'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-mesh px-4 py-16 text-slate-200">
      <Head>
        <title>Privacidad | Webycitas</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <article className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-white">Política de privacidad</h1>
        <p>
          Recibimos nombre, correo, teléfono y datos del negocio para armar una maqueta y contactarte
          sobre el servicio. No vendemos esa información.
        </p>
        <p>
          Las páginas publicadas en <code>/p/</code> capturan solicitudes del visitante y las envían al
          dueño del negocio.
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
