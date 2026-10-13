import { useCallback, useEffect, useState } from 'react'

/**
 * Aviso de éxito que se borra solo y mensaje de error que se borra al tener éxito,
 * para que un error viejo no quede pegado después de una acción que salió bien.
 */
export function useNotice(timeoutMs = 4000) {
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [notice, timeoutMs])

  const succeed = useCallback((message: string | null = null) => {
    setError(null)
    setNotice(message)
  }, [])

  const fail = useCallback((message: string) => {
    setNotice(null)
    setError(message)
  }, [])

  return { notice, error, succeed, fail }
}
