# Webycitas

Lead magnet + motor de maquetas. Repo y Supabase propios. El dueño de cada site es `leads.id` (`sites.lead_id`). No hay `company_id`, companies, planilla ni SuperAdmin.

Planilla (`saas-proyecto`) sigue sirviendo `/webycitas` hasta que este app esté en producción. No se vacía el módulo allá.

## Contrato

| Ruta | Qué hace |
| --- | --- |
| `/` | Magnet (antes `/webycitas`) |
| `POST /api/leads` | Inserta `leads` y publica `sites` |
| `/p/[slug]` | Render público (anon + GRANT por columna) |
| `POST /api/inquiries` | Formulario de la maqueta → `site_inquiries` |

301: `/webycitas` y `/demo-local` → `/`.

## Destinos (aislados de Planilla)

- GitHub: https://github.com/JAGC-siete/webycitas
- Supabase: proyecto `webycitas` (`cthzofskbfpcgapdauac`, us-east-2)
- Railway: project `handsome-forgiveness` (`d41dc0fb-8441-457b-8f83-77b7ffdd1416`)

El Postgres que Railway añadió en ese project **no se usa**. La app habla solo con Supabase.

## Arranque

1. Las migraciones `leads_sites_inquiries` y `client_suite` ya están aplicadas en el proyecto Supabase `webycitas`.
2. Copiar `.env.example` → `.env.local`. Llenar URL/keys de **ese** proyecto, no las de Planilla.
3. `npm install && npm test && npm run dev`.

## Railway

Servicio `webycitas` en el project `handsome-forgiveness`. Variables: las de `.env.example`. `NEXT_PUBLIC_*` también como build ARG. `SUPABASE_SERVICE_ROLE_KEY` solo en el dashboard, nunca en el repo.

## Fuera de este MVP

Bandeja SuperAdmin, reclamación de dominio, constructor autenticado.
