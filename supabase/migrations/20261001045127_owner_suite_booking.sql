-- Owner suite booking: staff, services, customers, appointments, blocks.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE public.appointment_status AS ENUM (
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'no_show'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_source') THEN
    CREATE TYPE public.appointment_source AS ENUM (
      'manual',
      'walk_in',
      'inquiry',
      'web'
    );
  END IF;
END$$;

-- =====================================================================
-- Tables
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#38bdf8',
  bio text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_members_name_len CHECK (length(trim(name)) BETWEEN 1 AND 80),
  CONSTRAINT staff_members_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT staff_members_bio_len CHECK (bio IS NULL OR length(bio) <= 500)
);

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT staff_schedules_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT staff_schedules_range CHECK (start_time < end_time),
  CONSTRAINT staff_schedules_unique UNIQUE (staff_id, weekday, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.bookable_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 30,
  buffer_min integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookable_services_name_len CHECK (length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT bookable_services_price_nonneg CHECK (price_cents >= 0 AND price_cents <= 999999999),
  CONSTRAINT bookable_services_duration CHECK (duration_min BETWEEN 5 AND 480),
  CONSTRAINT bookable_services_buffer CHECK (buffer_min BETWEEN 0 AND 120)
);

CREATE TABLE IF NOT EXISTS public.staff_services (
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.bookable_services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email citext,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_name_len CHECK (length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT customers_phone_len CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 30),
  CONSTRAINT customers_notes_len CHECK (notes IS NULL OR length(notes) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_site_phone_uidx
  ON public.customers (site_id, phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.bookable_services(id) ON DELETE SET NULL,
  inquiry_id uuid REFERENCES public.site_inquiries(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  source public.appointment_source NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_range CHECK (starts_at < ends_at),
  CONSTRAINT appointments_notes_len CHECK (notes IS NULL OR length(notes) <= 1000)
);

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_blocks_range CHECK (starts_at < ends_at),
  CONSTRAINT schedule_blocks_reason_len CHECK (reason IS NULL OR length(reason) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_staff_members_site ON public.staff_members (site_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bookable_services_site ON public.bookable_services (site_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_customers_site_name ON public.customers (site_id, name);
CREATE INDEX IF NOT EXISTS idx_appointments_site_starts ON public.appointments (site_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_starts ON public.appointments (staff_id, starts_at)
  WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_site_starts ON public.schedule_blocks (site_id, starts_at);

DROP TRIGGER IF EXISTS staff_members_set_updated_at ON public.staff_members;
CREATE TRIGGER staff_members_set_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bookable_services_set_updated_at ON public.bookable_services;
CREATE TRIGGER bookable_services_set_updated_at
  BEFORE UPDATE ON public.bookable_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS customers_set_updated_at ON public.customers;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Soft anti-overlap: only active statuses, only when staff assigned
CREATE INDEX IF NOT EXISTS appointments_staff_active_gist
  ON public.appointments
  USING gist (staff_id, tstzrange(starts_at, ends_at, '[)'))
  WHERE staff_id IS NOT NULL AND status IN ('pending', 'confirmed');

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_staff_overlap;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_staff_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (staff_id IS NOT NULL AND status IN ('pending', 'confirmed'));

-- =====================================================================
-- Helpers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.suite_owns_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.id = p_site_id
      AND s.lead_id = public.current_lead_id()
  );
$$;

REVOKE ALL ON FUNCTION public.suite_owns_site(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_owns_site(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.suite_day_summary(p_site_id uuid, p_day date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_tz text := 'America/Tegucigalpa';
  v_appts integer;
  v_revenue integer;
  v_cancelled integer;
  v_open_min integer := 0;
  v_booked_min integer;
  v_staff integer;
BEGIN
  IF NOT public.suite_owns_site(p_site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  v_start := (p_day::timestamp AT TIME ZONE v_tz);
  v_end := v_start + interval '1 day';

  SELECT count(*)::int,
         COALESCE(sum(bs.price_cents), 0)::int,
         COALESCE(sum(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 60), 0)::int
  INTO v_appts, v_revenue, v_booked_min
  FROM public.appointments a
  LEFT JOIN public.bookable_services bs ON bs.id = a.service_id
  WHERE a.site_id = p_site_id
    AND a.starts_at >= v_start
    AND a.starts_at < v_end
    AND a.status IN ('pending', 'confirmed', 'completed');

  SELECT count(*)::int INTO v_cancelled
  FROM public.appointments a
  WHERE a.site_id = p_site_id
    AND a.updated_at >= now() - interval '24 hours'
    AND a.status = 'cancelled';

  SELECT count(*)::int INTO v_staff
  FROM public.staff_members sm
  WHERE sm.site_id = p_site_id AND sm.is_active;

  -- Rough capacity: active staff × 8h − booked minutes
  v_open_min := GREATEST(0, (GREATEST(v_staff, 1) * 8 * 60) - COALESCE(v_booked_min, 0));

  RETURN jsonb_build_object(
    'appointments_today', COALESCE(v_appts, 0),
    'open_minutes', v_open_min,
    'revenue_cents', COALESCE(v_revenue, 0),
    'cancellations_24h', COALESCE(v_cancelled, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suite_day_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suite_day_summary(uuid, date) TO authenticated, service_role;

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookable_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staff_members FROM anon, authenticated;
REVOKE ALL ON public.staff_schedules FROM anon, authenticated;
REVOKE ALL ON public.bookable_services FROM anon, authenticated;
REVOKE ALL ON public.staff_services FROM anon, authenticated;
REVOKE ALL ON public.customers FROM anon, authenticated;
REVOKE ALL ON public.appointments FROM anon, authenticated;
REVOKE ALL ON public.schedule_blocks FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookable_services TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.schedule_blocks TO authenticated;

GRANT USAGE ON TYPE public.appointment_status TO authenticated;
GRANT USAGE ON TYPE public.appointment_source TO authenticated;

CREATE POLICY staff_members_owner_all ON public.staff_members
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY staff_schedules_owner_all ON public.staff_schedules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = staff_id AND public.suite_owns_site(sm.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = staff_id AND public.suite_owns_site(sm.site_id)
    )
  );

CREATE POLICY bookable_services_owner_all ON public.bookable_services
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY staff_services_owner_all ON public.staff_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = staff_id AND public.suite_owns_site(sm.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = staff_id AND public.suite_owns_site(sm.site_id)
    )
  );

CREATE POLICY customers_owner_all ON public.customers
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY appointments_owner_all ON public.appointments
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY schedule_blocks_owner_all ON public.schedule_blocks
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));
