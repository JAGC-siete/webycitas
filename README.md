# Webycitas

Lead magnet + motor de maquetas + directorio Mercado San Pablo. Repo y Supabase propios. El dueño de cada site es `leads.id` (`sites.lead_id`). No hay `company_id`, companies, planilla ni SuperAdmin de RRHH.

Planilla (`saas-proyecto` / humanosisu.net) sigue sirviendo `/webycitas` y `/mercadosanpablosigua` hasta un cutover explícito. Este repo no vacía esos módulos allá. Este paso no apunta `humanosisu.net` ni 301 desde HR.

## Contrato

| Ruta | Qué hace |
| --- | --- |
| `/` | Magnet (antes `/webycitas`) |
| `POST /api/leads` | Inserta `leads` y publica `sites` |
| `/p/[slug]` | Render público (anon + GRANT por columna) |
| `POST /api/inquiries` | Formulario de la maqueta → `site_inquiries` |
| `/mercadosanpablosigua` | Directorio v1 (puestos / locatarios) |
| `/mercadosanpablosigua/inscripcion` | Inscripción Pickup → `mercado_vendor_applications` |
| `/mercadosanpablosigua/[slug]` | Ficha de puesto |
| `/mercadosanpablosiguav2` | Landing institucional (visita física) |
| `/app/mercado/login` | Login mínimo del operador municipal |
| `/app/mercado/fichas` | Admin de fichas (`/nueva`, `/[id]`) |
| `/app/mercado/solicitudes` | Bandeja de inscripciones |
| `POST /api/mercado/inscriptions` | Alta pública de solicitud |
| `/api/admin/mercado/*` | APIs de operador (cookie HMAC, service role) |

301: `/webycitas` y `/demo-local` → `/`. `/mercado` (sin extensión) → `/mercadosanpablosigua`. Los PNG de `/mercado/*.png` no se reescriben.

## Destinos (aislados de Planilla)

- GitHub: https://github.com/JAGC-siete/webycitas
- Supabase: proyecto `webycitas` (`cthzofskbfpcgapdauac`, us-east-2)
- Railway: project `handsome-forgiveness` (`d41dc0fb-8441-457b-8f83-77b7ffdd1416`), servicio `webycitas`, URL https://webycitas-production.up.railway.app

El Postgres que Railway añadió en ese project **no se usa**. La app habla solo con Supabase Webycitas.

## Mercado: inventario de porte

| Pieza | Destino |
| --- | --- |
| UI pública, CSS, `lib/mercado/*` de copy/SEO/WhatsApp, `public/mercado/` | Copia |
| APIs de inscripción y CRUD, `vendors-db`, `public-client` | Reescritura: clientes de `lib/supabase/{admin,public}.ts` |
| Admin `/app/admin/mercado-*` + `SuperAdminGuard` + `requireSuperAdminWithAudit` | Dejado de lado. Reemplazo: `/app/mercado/*` + cookie HMAC |
| `company_id`, `user_profiles`, `companies`, `RoleId` | Dejado de lado |
| Tablas `vendors` / `vendor_applications` de HR | No se copian. Aquí: `mercado_vendors`, `mercado_vendor_applications` |
| `landing_pages` / `sites` / `leads` | Sin puente. Fichas de mercado no son sites |
| Storage `mercado-san-pablo` | Bucket propio, lectura pública, escritura service role |
| Resend | `RESEND_API_KEY` reutilizable. `RESEND_FROM` = marca Mercado/Webycitas, no SISU Nómina. No se copia `RESEND_WEBHOOK_SECRET` |
| Tests `middleware.config` / SEO de marketing HR | Dejados de lado. El resto de `tests/mercado-*.test.ts` aplica |

RLS: `anon` lee fichas `status='active'` (GRANT por columna). `mercado_vendor_applications` no tiene policy ni GRANT: insert solo service role. Operador no usa `authenticated` de Supabase.

## Arranque

1. Las migraciones `leads_sites_inquiries`, `client_suite` y `mercado_directorio` ya están aplicadas en el proyecto Supabase `webycitas`.
2. Copiar `.env.example` → `.env.local`. Llenar URL/keys de **ese** proyecto, no las de Planilla.
3. `npm install && npm test && npm run dev`.

## Variables

Las de `.env.example`. Nuevas para Mercado:

| Variable | Uso |
| --- | --- |
| `RESEND_FROM` | Remitente. Marca Mercado San Pablo / Webycitas. No “SISU Nómina”. |
| `NOTIFY_EMAIL` / `MERCADO_INSCRIPTION_NOTIFY_EMAIL` | Destino del aviso de inscripción |
| `MERCADO_ADMIN_EMAIL` | Correo del operador |
| `MERCADO_ADMIN_PASSWORD` | Contraseña del operador (mín. 8) |
| `MERCADO_ADMIN_SESSION_SECRET` | HMAC de la cookie (mín. 16). Solo dashboard. |

`NEXT_PUBLIC_*` también como build ARG en Railway. `SUPABASE_SERVICE_ROLE_KEY` y los secretos de operador solo en el dashboard, nunca en el repo.

## Railway

Servicio `webycitas` en el project `handsome-forgiveness`. Un solo proceso Node: magnet + Mercado.

## Fuera de este MVP

Bandeja SuperAdmin de RRHH, reclamación de dominio, constructor autenticado, cutover de `humanosisu.net/mercadosanpablosigua`.
