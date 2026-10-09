@README.md

# Webycitas

Reglas propias de este repo. Las generales están en `~/.claude/CLAUDE.md`; el contrato técnico, en `README.md`.

## Texto para el owner

- Nada de "Ledger", "Staff", "inyectan", "panel ops" ni estados crudos como `confirmed` o `no_show`.
- Contraste legible: texto tenue nunca por debajo de `white/55` (4.5:1).

## Límites

- Webycitas y Mercado San Pablo no comparten CTAs, leads, cookies, ads ni tablas (`mercado_*` no son `sites`/`leads`).
- Planilla (`humanosisu.net`) no se toca. Nada de `company_id`, `companies` ni su sesión.
- Supabase solo el proyecto `webycitas` (`cthzofskbfpcgapdauac`). El Postgres de Railway no se usa.

## Cómo trabajo aquí

- Reutilizo `components/ui` (`Button`, `dialog`) y `components/suite/useNotice` antes de crear algo nuevo.
- Dev server: `webycitas-dev`, puerto 3000.
- Formularios: validan antes de enviar, campos con label, acciones destructivas piden confirmación nombrando lo que se borra.
- Verificar: `npm run typecheck` y `npm test`. Un test nuevo se agrega a mano al script `test` de `package.json`, que los lista uno por uno.
