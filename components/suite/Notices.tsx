/** Aviso de éxito y error de una pantalla del panel, anunciados a lectores de pantalla. */
export default function Notices({
  notice,
  error,
  onRetry,
}: {
  notice: string | null
  error: string | null
  onRetry?: () => void
}) {
  return (
    <>
      {notice ? (
        <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          <span>{error}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-red-300/40 px-2 py-0.5 text-xs font-medium hover:bg-red-500/20"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
