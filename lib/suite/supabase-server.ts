/**
 * Cliente de Supabase con la sesión del cliente, para Pages Router.
 *
 * La sesión vive en cookies, así que getServerSideProps y las rutas de API leen
 * al mismo usuario sin pasar tokens por el body. Este cliente respeta RLS: es el
 * que se usa para TODA lectura y escritura de datos del negocio.
 */

import { createServerClient, serializeCookieHeader, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'

type ReqLike = NextApiRequest | GetServerSidePropsContext['req']
type ResLike = NextApiResponse | GetServerSidePropsContext['res']

export function createSuiteServerClient(req: ReqLike, res: ResLike): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const jar = req.cookies as Record<string, string | undefined>
        return Object.entries(jar)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([name, value]) => ({ name, value }))
      },
      setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
        if (res.writableEnded) return
        const existing = res.getHeader('Set-Cookie')
        const previous = Array.isArray(existing)
          ? existing
          : typeof existing === 'string'
            ? [existing]
            : []
        res.setHeader('Set-Cookie', [
          ...previous,
          ...cookies.map(({ name, value, options }) => serializeCookieHeader(name, value, options)),
        ])
      },
    },
  })
}
