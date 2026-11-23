# Webycitas + Mercado Digital de Siguatepeque

Una sola app Next.js con dos productos. El host decide cuál se muestra:

- **Webycitas**: lead magnet + motor de maquetas + suite del dueño. El dueño de cada site es `leads.id` (`sites.lead_id`).
- **Mercado Digital de Siguatepeque**: directorio de negocios de Siguatepeque. Registro básico gratis; inscripción destacada L. 1,500 al año. Antes vivía en el repo `mercado-sigua`.

No hay `company_id`, companies, planilla ni SuperAdmin de RRHH. `humanosisu.net` queda para Planilla (`/app/admin`) y no comparte sesión con esta app.

## Hosts

| Host | Producto | Notas |
| --- | --- | --- |
| `webycitas.humanosisu.net` (y el dominio de Railway, `localhost`) | Webycitas | Magnet en `/`, operador en `/admin`, dueño en `/app` |
| `sigua-online.com` | Directorio | Host canónico cuando `NEXT_PUBLIC_MERCADO_SITE_URL=https://sigua-online.com` |
| `mercado.humanosisu.net`, `www.sigua-online.com` | Directorio (dominio viejo) | 301 al host canónico, salvo `/api/*` |
| `sigua.localhost` | Directorio en local | `http://sigua.localhost:3000` |

Cómo funciona: `middleware.ts` llama a `routeForHost` (`lib/hosts.ts`).

- En un host del directorio reescribe cada ruta a `pages/sigua/*` y cada API a `pages/api/sigua/*`. La URL pública nunca lleva `/sigua`; si alguien la escribe, 301 a la ruta limpia.
- En cualquier otro host, `/sigua/*` y `/api/sigua/*` dan 404, y las rutas de la copia vieja del directorio (`/mercadosanpablosigua*`, `/mercado*`, `/app/mercado/*`) van con 301 al directorio. Sin `NEXT_PUBLIC_MERCADO_SITE_URL` dan 404.
- `router.pathname` del directorio sí trae `/sigua`: para comparar rutas usa `stripSiguaPrefix` (`lib/mercado/paths.ts`).
- Cookies por host (sin `Domain=`): el directorio y Webycitas nunca comparten cookie de sesión.

Corte pendiente: hoy el DNS de `mercado.humanosisu.net` todavía apunta al servicio aparte de `mercado-sigua`. Este código queda listo para cuando ese dominio y `sigua-online.com` se agreguen al servicio `webycitas`.

### GTM: dos productos, un solo puente

| Producto | Host | Funnel | Precio |
| --- | --- | --- | --- |
| **Webycitas** | `webycitas.humanosisu.net` | Magnet → lead → site `/p/[slug]` → suite owner | Packs desde L. 990/mes (copy en `DEMO_LOCAL_COPY` / `WEBYCITAS_PRICING_PACKS`) |
| **Mercado Digital de Siguatepeque** | `sigua-online.com` (hoy `mercado.humanosisu.net`) | Directorio de negocios de Siguatepeque | Inscripción básica gratis · destacada L. 1,500/año |

Mercado (sigua-online.com) → Webycitas: solo un CTA para dueños con `?ref=sigua-online` y el enlace al sitio de cada negocio. Comparten app y base de datos, pero no tablas de negocio (`mercado_*` no son `sites`/`leads`), ni cookies (cada host tiene las suyas), ni ads.

Atribución: `/?ref=` acepta solo los valores de `WEBYCITAS_LEAD_REFS` (`lib/magnet/demo-local.ts`); cualquier otro se ignora. El valor se guarda en `leads.source` (por defecto `webycitas`) y `/admin` muestra el origen de cada lead y cuántos vienen de sigua-online.com.

## Login

Por ahora hay dos logins, uno por producto, sobre la misma tabla `site_user_profiles` y el mismo Supabase Auth:

| Producto | Código | Roles | Notas |
| --- | --- | --- | --- |
| Webycitas | `lib/auth/*`, `pages/api/auth/*` | `super_admin`, `owner` | `leads.auth_user_id` |
| Directorio | `lib/sigua/auth/*`, `pages/api/sigua/auth/*` | `super_admin`, `vendor` | `mercado_vendors.auth_user_id`; claim por `contact_email` |

Pendiente: unificarlos en uno solo que redirija según el rol. El CHECK de `site_user_profiles.role` en la base solo admite `super_admin` y `owner`, así que invitar a un dueño del directorio (`vendor`) falla hasta que se agregue ese rol.

`lib/sigua/` guarda las piezas del directorio que divergieron de las de Webycitas (auth, `site.ts`, `rate-limit.ts`, `resend-from.ts`, clientes de Supabase). Se van a fusionar con las de Webycitas.

## Contrato: host de Webycitas

| Ruta | Qué hace |
| --- | --- |
| `/` | Magnet (antes `/webycitas`) |
| `POST /api/leads` | Inserta `leads` y publica `sites` |
| `/p/[slug]` | Render público (anon + GRANT por columna) |
| `POST /api/inquiries` | Formulario de la maqueta → `site_inquiries` |
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

301: `/webycitas` y `/demo-local` → `/`.

## Contrato: host del directorio

Rutas públicas (el archivo vive en `pages/sigua/<ruta>`, la API en `pages/api/sigua/<ruta>`):

| Ruta | Qué hace |
| --- | --- |
| `/` | Directorio de negocios |
| `/inscripcion` | Inscripción → `mercado_vendor_applications` |
| `/negocios/[slug]` | Ficha de negocio |
| `/mercado-san-pablo` | Página del Mercado Municipal San Pablo (visita física) |
| `/app/login` | Login del directorio (super_admin + vendor) |
| `/app/forgot-password` | Recuperación de contraseña |
| `/auth/update-password` | Set/reset password (invite / recovery) |
| `/app` | Home del dueño del negocio |
| `/app/mercado` | Home operador (stats) |
| `/app/mercado/fichas` | Admin de fichas (`/nueva`, `/[id]`) |
| `/app/mercado/solicitudes` | Bandeja de inscripciones |
| `/app/mercado/configuracion` | Cierre forzado, horario, WhatsApp soporte |
| `/app/mercado/login` | 301 → `/app/login?redirect=/app/mercado` |
| `POST /api/auth/login` | Login (rate limit, role gate, claim vendor) |
| `POST /api/mercado/inscriptions` | Alta pública de solicitud |
| `/api/admin/mercado/*` | APIs de operador (JWT `super_admin`, service role) |
| `/robots.txt` | `public/sigua-robots.txt` |

301 de la marca anterior (un solo salto):

| Antes | Ahora |
| --- | --- |
| `/mercadosanpablosigua`, `/mercado` | `/` |
| `/mercadosanpablosigua/inscripcion`, `/mercado/inscripcion` | `/inscripcion` |
| `/mercadosanpablosigua/[slug]`, `/mercado/[slug]` | `/negocios/[slug]` |
| `/mercadosanpablosiguav2` | `/mercado-san-pablo` |

Los archivos de `/mercado/*.png` no se redirigen: también los usan las plantillas de Webycitas (`lib/landings/retail-visit.ts`).

RLS: `anon` lee fichas `status='active'` (GRANT por columna). El dueño autenticado lee y actualiza su ficha vía `current_vendor_id()`. `mercado_vendor_applications` no tiene policy pública: insert solo service role. Storage: bucket `mercado-san-pablo`, lectura pública, escritura service role.

## Destinos (aislados de Planilla)

- GitHub: https://github.com/JAGC-siete/webycitas
- Supabase: proyecto `cthzofskbfpcgapdauac` (us-east-2; en el panel se llama "sandbox"). Tiene las tablas de los dos productos y también las `profe_*` de Profe App.
- Railway: project `handsome-forgiveness` (`d41dc0fb-8441-457b-8f83-77b7ffdd1416`), servicio `webycitas`, URL https://webycitas-production.up.railway.app

El Postgres que Railway añadió en ese project **no se usa**. La app habla solo con Supabase.

Migraciones: las del directorio (`mercado_directorio` v2, `user_profiles_sessions_vendors_auth`, `superadmin_pareto_suite`) se aplicaron a mano desde `mercado-sigua` y todavía no están en `supabase/migrations`. Varias de las dos apps tampoco aparecen en el historial de Supabase. Ordenarlas va junto con la unificación del login, porque ambas apps definen `create_user_session` con cuerpos distintos.

## Arranque

1. Las migraciones de `supabase/migrations` van al proyecto Supabase `cthzofskbfpcgapdauac`. No a Planilla.
2. Copiar `.env.example` → `.env.local`. Llenar URL/keys de **ese** proyecto, no las de Planilla.
3. Seed one-shot del primer `super_admin` (env, nunca en el repo):
   `WEBYCITAS_SUPERADMIN_EMAIL` + `WEBYCITAS_SUPERADMIN_PASSWORD` (o el trio viejo `WEBYCITAS_ADMIN_*` solo para el corte).
   `npm run seed:super-admin`
4. En Supabase Auth → URL configuration: Site URL `https://webycitas.humanosisu.net` (nunca localhost). Redirect Allow List con `https://webycitas.humanosisu.net/auth/update-password**` y la misma ruta en el host del directorio. En Railway, `NEXT_PUBLIC_SITE_URL` debe ser la URL pública de Webycitas y `NEXT_PUBLIC_MERCADO_SITE_URL` la del directorio.
5. En Supabase Auth → Password security: activar **Leaked password protection** (HaveIBeenPwned) en el proyecto `cthzofskbfpcgapdauac`.
6. `npm install && npm test && npm run dev`. Webycitas en `http://localhost:3000`, directorio en `http://sigua.localhost:3000`.
7. Tras verificar login JWT, borrar `WEBYCITAS_ADMIN_EMAIL` / `WEBYCITAS_ADMIN_PASSWORD` / `WEBYCITAS_ADMIN_SESSION_SECRET` de Railway.

## Variables

Las de `.env.example`:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL pública de Webycitas. Build ARG |
| `NEXT_PUBLIC_MERCADO_SITE_URL` | URL pública del directorio (hoy `https://mercado.humanosisu.net`, luego `https://sigua-online.com`). Canonical, correos y 301. Build ARG |
| `RESEND_FROM` | Remitente de Webycitas. No “SISU Nómina” |
| `MERCADO_RESEND_FROM` | Remitente del directorio |
| `NOTIFY_EMAIL` / `MERCADO_INSCRIPTION_NOTIFY_EMAIL` | Destino de avisos internos y de inscripción |
| `MERCADO_HOSTS` / `MERCADO_LEGACY_HOSTS` | Hosts extra del directorio / del dominio viejo (coma) |
| `MERCADO_ADMIN_*` | Login HMAC viejo del operador, ya retirado (responde 410). No hace falta en Railway |
| `WEBYCITAS_SUPERADMIN_EMAIL` / `WEBYCITAS_SUPERADMIN_PASSWORD` | Solo seed. No quedan en `.env.example` |

`NEXT_PUBLIC_*` también como build ARG en Railway. `SUPABASE_SERVICE_ROLE_KEY` y los secretos de operador solo en el dashboard, nunca en el repo.

## Railway

Servicio `webycitas` en el project `handsome-forgiveness`. Un solo proceso Node para los dos productos.

Custom domains hoy (CNAME al host de Railway):

- `webycitas.humanosisu.net`

Al hacer el corte se agregan `mercado.humanosisu.net` y `sigua-online.com` (y `www.`) a este servicio, y se apaga el servicio de `mercado-sigua`.

`humanosisu.net` no se mueve. Sigue en el servicio de Planilla.

## Fuera de este MVP

Constructor `/app/sitio`, reservas e inventario. `/app` es stub del owner.
