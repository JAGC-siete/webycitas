# Webycitas

Lead magnet + motor de maquetas + directorio Mercado San Pablo. Repo y Supabase propios. El dueño de cada site es `leads.id` (`sites.lead_id`). No hay `company_id`, companies, planilla ni SuperAdmin de RRHH.

`humanosisu.net` queda para Planilla (`/app/admin`). Este servicio no comparte esa sesión. Dos subdominios apuntan aquí, cada uno con su operador:

| Host | Puerta |
| --- | --- |
| `webycitas.humanosisu.net` | Magnet en `/`. Operador en `/admin` |
| `mercado.humanosisu.net` | Directorio en `/` (rewrite a `/mercadosanpablosigua`). Operador en `/app/mercado/login` |

Las cookies son del host (sin `Domain=.humanosisu.net`). No comparte Auth con Planilla. Webycitas: un form en `/app/login` (`user_profiles.role` + `leads.auth_user_id`). Mercado sigue con cookie HMAC (`MERCADO_ADMIN_*`).

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
| `/app/login` | Login unificado (super_admin + owner) |
| `/app/forgot-password` | Recuperación de contraseña |
| `/auth/update-password` | Alta/cambio de password (invite o recovery) |
| `/app` | Dashboard del owner (citas hoy, alertas, accesos rápidos) |
| `/app/reservas` | Agenda día/semana, citas manuales, bloqueos |
| `/app/reservas/equipo` | Staff, horarios y servicios |
| `/app/sitio` | Mini CMS: servicios, negocio, galería, publicar |
| `/app/clientes` | Mini CRM + export CSV |
| `/admin/login` | 301 → `/app/login?redirect=/admin` |
| `/admin` | Leads + métricas (`received` / `reviewed` / `rejected`). Solo `super_admin` |
| `/admin/sites` | Sites y enlace a `/p/[slug]` |
| `/admin/inquiries` | Consultas de los sites |
| `/admin/users` | Operadores `super_admin` (activar/desactivar) |
| `/app/mercado/login` | Login del operador municipal |
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

1. Las migraciones `leads_sites_inquiries`, `client_suite`, `mercado_directorio`, `user_profiles_sessions`, `p0_ops_hardening` y `owner_suite_booking` van al proyecto Supabase `webycitas` (`cthzofskbfpcgapdauac`). No a Planilla.
2. Copiar `.env.example` → `.env.local`. Llenar URL/keys de **ese** proyecto, no las de Planilla.
3. Seed one-shot del primer `super_admin` (env, nunca en el repo):
   `WEBYCITAS_SUPERADMIN_EMAIL` + `WEBYCITAS_SUPERADMIN_PASSWORD` (o el trio viejo `WEBYCITAS_ADMIN_*` solo para el corte).
   `npm run seed:super-admin`
4. En Supabase Auth → URL configuration: Site URL `https://webycitas.humanosisu.net` y Redirect `https://webycitas.humanosisu.net/auth/update-password`.
5. En Supabase Auth → Password security: activar **Leaked password protection** (HaveIBeenPwned) en el proyecto `cthzofskbfpcgapdauac`.
6. `npm install && npm test && npm run dev`.
7. Tras verificar login JWT, borrar `WEBYCITAS_ADMIN_EMAIL` / `WEBYCITAS_ADMIN_PASSWORD` / `WEBYCITAS_ADMIN_SESSION_SECRET` de Railway.

## Variables

Las de `.env.example`. Nuevas para Mercado:

| Variable | Uso |
| --- | --- |
| `RESEND_FROM` | Remitente. Marca Mercado San Pablo / Webycitas. No “SISU Nómina”. |
| `NOTIFY_EMAIL` / `MERCADO_INSCRIPTION_NOTIFY_EMAIL` | Destino del aviso de inscripción |
| `MERCADO_ADMIN_EMAIL` | Correo del operador de Mercado |
| `MERCADO_ADMIN_PASSWORD` | Contraseña de Mercado (mín. 8) |
| `MERCADO_ADMIN_SESSION_SECRET` | HMAC de la cookie de Mercado (mín. 16) |
| `WEBYCITAS_SUPERADMIN_EMAIL` / `WEBYCITAS_SUPERADMIN_PASSWORD` | Solo seed. No quedan en `.env.example` |

`NEXT_PUBLIC_*` también como build ARG en Railway. `SUPABASE_SERVICE_ROLE_KEY` y los secretos de operador solo en el dashboard, nunca en el repo.

## Railway

Servicio `webycitas` en el project `handsome-forgiveness`. Un solo proceso Node: magnet + Mercado + los dos operadores.

Custom domains en ese servicio (CNAME al host de Railway):

- `webycitas.humanosisu.net`
- `mercado.humanosisu.net`

`humanosisu.net` no se mueve. Sigue en el servicio de Planilla.

## Fuera de este MVP

Constructor `/app/sitio`, reservas e inventario. `/app` es stub del owner. Mercado no usa este login.
