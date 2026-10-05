/**
 * Subida de imagen al bucket site-media + preview + URL editable.
 */

import { useState, type ChangeEvent } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { suiteFetch } from '../../lib/auth/client-session'
import type { SiteMediaKind } from '../../lib/suite/media'
import { SUITE_MEDIA_UPLOAD_API } from '../../lib/suite/paths'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export default function ImageUploadField({
  value,
  onChange,
  siteId,
  kind,
  label = 'Imagen',
  className,
  inputClassName,
}: {
  value?: string
  onChange: (next: string) => void
  siteId: string
  kind: SiteMediaKind
  label?: string
  className?: string
  inputClassName?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const dataBase64 = await fileToBase64(file)
      const res = await suiteFetch(SUITE_MEDIA_UPLOAD_API, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          contentType: file.type,
          dataBase64,
          siteId,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error || 'No se pudo subir')
      onChange(body.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Subiendo…' : `Subir ${label.toLowerCase()}`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => void onFile(event)}
          />
        </label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => onChange('')}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Quitar
          </Button>
        ) : null}
      </div>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-24 w-full max-w-xs rounded-lg border border-white/10 object-cover"
        />
      ) : null}
      <Input
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://… o /img/…"
        className={cn('bg-white/10 text-white placeholder:text-gray-500', inputClassName)}
        disabled={uploading}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
