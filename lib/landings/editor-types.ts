/**
 * Tipos neutros del editor de landings (ops y suite).
 */

import type { LandingPageContent, LandingPageStatus, LandingTemplateKey } from '../../types/landing'

export interface LandingEditRecord {
  id: string
  lead_id?: string
  title: string
  slug: string
  template_type: LandingTemplateKey
  status: LandingPageStatus
  content_json: unknown
  lead_notify_email: string | null
  published_at: string | null
  /** Publicado con un borrador distinto al que ve el público. */
  has_unpublished_changes?: boolean
  created_at?: string
  updated_at?: string
}

export interface SaveLandingDraftInput {
  title: string
  /** Solo ops puede renombrar. Suite omite. */
  slug?: string
  leadNotifyEmail: string | null
  content: LandingPageContent
}

export interface PublishLandingResult {
  status: LandingPageStatus
  published_at: string | null
}
