/**
 * Supabase errors from updateUser({ password }) → plain words for the owner.
 * Unknown codes fall back to a generic message instead of English text.
 */

interface AuthErrorLike {
  code?: string
  message?: string
}

export function passwordUpdateErrorMessage(error: AuthErrorLike | null | undefined): string {
  switch (error?.code) {
    case 'same_password':
      return 'Esa es tu contraseña actual. Escribe una distinta para cambiarla.'
    case 'weak_password':
      return 'Esa contraseña es muy fácil de adivinar o ya apareció en filtraciones. Usa una más larga y distinta.'
    case 'session_not_found':
    case 'session_expired':
      return 'Tu acceso venció. Pide un enlace nuevo con “Olvidé mi contraseña”.'
    default:
      return 'No se pudo guardar la contraseña. Intenta de nuevo en un momento.'
  }
}
