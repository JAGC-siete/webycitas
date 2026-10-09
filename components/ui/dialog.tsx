import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Modal accesible: role="dialog", cierra con Escape o tocando el fondo,
 * enfoca el campo con data-autofocus (o el primero), mantiene el Tab adentro
 * y devuelve el foco al cerrar.
 */
function Dialog({ title, onClose, children, className }: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // Se lee en el primer render, antes de que el diálogo mueva el foco.
  const previousRef = useRef(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
  )

  useEffect(() => {
    const previous = previousRef.current
    const panel = panelRef.current
    // Enfoca el campo marcado con data-autofocus; si no hay, el primero (no la X de cerrar).
    const marked = panel?.querySelector<HTMLElement>('[data-autofocus]')
    const fields = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)
    const firstField = Array.from(fields ?? []).find((el) => !el.dataset.dialogClose)
    ;(marked ?? firstField ?? panel)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'glass-modern max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl p-5 text-white focus:outline-none',
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            data-dialog-close="true"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export { Dialog }
