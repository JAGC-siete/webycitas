import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { Loader2 } from 'lucide-react'
import SuperAdminGuard from '../../../../components/auth/SuperAdminGuard'
import LandingSplitEditor from '../../../../components/landings/editor/LandingSplitEditor'
import { Button } from '../../../../components/ui/button'
import { requireSuperAdminPage } from '../../../../lib/auth/api-auth'
import { fetchLanding, publishLanding, saveLanding } from '../../../../lib/landings/admin-api'
import type { LandingEditRecord, SaveLandingDraftInput } from '../../../../lib/landings/editor-types'
import { editorFormSchema } from '../../../../lib/landings/editor-form'
import {
  LANDINGS_ADMIN_PATH,
  landingAdminLeadsPath,
} from '../../../../lib/landings/paths'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSuperAdminPage(ctx)
  if (!auth.ok) return { redirect: auth.redirect }
  return { props: {} }
}

function OpsEditorLoader({ landingId }: { landingId: string }) {
  const router = useRouter()
  const [initial, setInitial] = useState<LandingEditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { landing } = await fetchLanding(landingId)
        if (active) setInitial(landing)
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la landing')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [landingId])

  const onSave = useCallback(
    async (input: SaveLandingDraftInput) => {
      const { landing } = await saveLanding(landingId, input)
      return landing
    },
    [landingId]
  )

  const onPublish = useCallback(
    async (action: 'publish' | 'unpublish') => publishLanding(landingId, action),
    [landingId]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Cargando el editor…</span>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm text-red-400">{error ?? 'Landing no encontrada'}</p>
        <Button variant="outline" className="mt-4" onClick={() => void router.push(LANDINGS_ADMIN_PATH)}>
          Volver al listado
        </Button>
      </div>
    )
  }

  return (
    <LandingSplitEditor
      landingId={landingId}
      initial={initial}
      formSchema={editorFormSchema}
      slugEditable
      canUnpublish
      backHref={LANDINGS_ADMIN_PATH}
      leadsHref={landingAdminLeadsPath(landingId)}
      onSave={onSave}
      onPublish={onPublish}
    />
  )
}

export default function LandingEditorPage() {
  const router = useRouter()
  const rawId = router.query.id
  const landingId = Array.isArray(rawId) ? rawId[0] : rawId

  return (
    <SuperAdminGuard redirectPath="/app">
      <Head>
        <title>Editor de página | Webycitas</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-slate-950 text-white">
        {landingId ? (
          <OpsEditorLoader landingId={landingId} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-gray-300">Cargando…</div>
        )}
      </div>
    </SuperAdminGuard>
  )
}
