-- Webycitas standalone: Lead dueño del site. Sin companies, sin company_id, sin Planilla.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE public.lead_status AS ENUM ('received', 'reviewed', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_status') THEN
    CREATE TYPE public.site_status AS ENUM ('draft', 'published', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_template') THEN
    CREATE TYPE public.site_template AS ENUM (
      'papeleria',
      'barberia',
      'salon_belleza',
      'spa',
      'comercial',
      'ferreteria',
      'mercadito',
      'supermercado',
      'clinica'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name text NOT NULL,
  business_name text NOT NULL,
  email citext NOT NULL,
  phone text NOT NULL,
  rubro text NOT NULL,
  city text NOT NULL,
  note text,
  services text[] NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'received',
  source text NOT NULL DEFAULT 'webycitas',
  consented_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  preview_slug text,
  site_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_owner_name_len CHECK (length(trim(owner_name)) BETWEEN 2 AND 80),
  CONSTRAINT leads_business_name_len CHECK (length(trim(business_name)) BETWEEN 2 AND 120),
  CONSTRAINT leads_phone_len CHECK (length(trim(phone)) BETWEEN 7 AND 30),
  CONSTRAINT leads_city_len CHECK (length(trim(city)) BETWEEN 2 AND 80),
  CONSTRAINT leads_note_len CHECK (note IS NULL OR length(note) <= 500),
  CONSTRAINT leads_rubro_check CHECK (
    rubro = ANY (ARRAY[
      'barberia',
      'ferreteria',
      'cafeteria',
      'mercadito',
      'escuela',
      'otro',
      'papeleria',
      'supermercado',
      'spa',
      'clinica',
      'salon'
    ])
  ),
  CONSTRAINT leads_services_check CHECK (
    cardinality(services) BETWEEN 1 AND 2
    AND services <@ ARRAY['landing'::text, 'booking'::text]
  ),
  CONSTRAINT leads_source_len CHECK (length(trim(source)) BETWEEN 3 AND 40),
  CONSTRAINT leads_preview_slug_format CHECK (
    preview_slug IS NULL
    OR (
      preview_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      AND length(preview_slug) BETWEEN 3 AND 63
    )
  )
);

COMMENT ON TABLE public.leads IS
  'Solicitudes del magnet /. Dueño de sites.lead_id. Insert solo con service role.';
COMMENT ON COLUMN public.leads.preview_slug IS
  'Slug público /p/{slug}. NULL si el insert en sites falló.';

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  template_type public.site_template NOT NULL,
  status public.site_status NOT NULL DEFAULT 'draft',
  schema_version integer NOT NULL DEFAULT 1,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_content_json jsonb,
  lead_notify_email citext,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_title_len CHECK (length(trim(title)) BETWEEN 2 AND 120),
  CONSTRAINT sites_slug_format CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 63
  ),
  CONSTRAINT sites_schema_version_positive CHECK (schema_version >= 1),
  CONSTRAINT sites_content_object CHECK (jsonb_typeof(content_json) = 'object'),
  CONSTRAINT sites_published_content_object CHECK (
    published_content_json IS NULL OR jsonb_typeof(published_content_json) = 'object'
  ),
  CONSTRAINT sites_published_requires_snapshot CHECK (
    status <> 'published' OR (published_content_json IS NOT NULL AND published_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.sites IS
  'Maquetas públicas /p/[slug]. El dueño es leads.id. Sin company_id.';
COMMENT ON COLUMN public.sites.content_json IS
  'Borrador. Contrato Zod en lib/landings/page-schema.ts.';
COMMENT ON COLUMN public.sites.published_content_json IS
  'Snapshot que sirve el render público. GRANT anon no incluye content_json.';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_site_fk;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_site_fk
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.site_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email citext,
  phone text,
  message text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'landing-page',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_inquiries_full_name_len CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
  CONSTRAINT site_inquiries_message_len CHECK (message IS NULL OR length(message) <= 1000),
  CONSTRAINT site_inquiries_extra_object CHECK (jsonb_typeof(extra) = 'object'),
  CONSTRAINT site_inquiries_contact_present CHECK (
    email IS NOT NULL OR (phone IS NOT NULL AND length(regexp_replace(phone, '\D', '', 'g')) >= 7)
  )
);

COMMENT ON TABLE public.site_inquiries IS
  'Solicitudes del formulario de un site publicado. Insert solo con service role.';

CREATE UNIQUE INDEX IF NOT EXISTS sites_slug_uidx ON public.sites (slug);
CREATE UNIQUE INDEX IF NOT EXISTS sites_lead_id_uidx ON public.sites (lead_id);
CREATE INDEX IF NOT EXISTS idx_sites_status_published_at ON public.sites (status, published_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS leads_preview_slug_uidx
  ON public.leads (preview_slug)
  WHERE preview_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON public.leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);

CREATE INDEX IF NOT EXISTS idx_site_inquiries_site_created_at
  ON public.site_inquiries (site_id, created_at DESC);

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sites_set_updated_at ON public.sites;
CREATE TRIGGER sites_set_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.leads FROM anon, authenticated;
REVOKE ALL ON public.sites FROM anon, authenticated;
REVOKE ALL ON public.site_inquiries FROM anon, authenticated;

GRANT USAGE ON TYPE public.site_status TO anon;
GRANT USAGE ON TYPE public.site_template TO anon;

GRANT SELECT (
  id,
  slug,
  title,
  template_type,
  status,
  schema_version,
  published_content_json,
  published_at
) ON public.sites TO anon;

DROP POLICY IF EXISTS sites_public_select ON public.sites;
CREATE POLICY sites_public_select
  ON public.sites
  FOR SELECT TO anon
  USING (status = 'published' AND published_content_json IS NOT NULL);
