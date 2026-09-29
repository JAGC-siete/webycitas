-- Suite del Cliente: el dueño del site entra a administrarlo.
--
-- Tenant = leads.id. Un lead se vincula a un usuario de auth por correo y desde
-- ahí solo ve su propio site, sus solicitudes y su inventario.
-- El render público de /p/[slug] sigue intacto: anon no gana ni pierde permisos.

-- =====================================================================
-- 1) Vínculo lead ↔ usuario de auth
-- =====================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.leads.auth_user_id IS
  'Usuario de auth que administra este negocio. NULL = lead que nunca entró al panel.';
COMMENT ON COLUMN public.leads.claimed_at IS
  'Primer ingreso al panel. Marca el paso de lead a cliente activo.';

CREATE UNIQUE INDEX IF NOT EXISTS leads_auth_user_id_uidx
  ON public.leads (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- =====================================================================
-- 2) Inventario como tercer servicio contratable
-- =====================================================================

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_services_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_services_check CHECK (
    cardinality(services) BETWEEN 1 AND 3
    AND services <@ ARRAY['landing'::text, 'booking'::text, 'inventory'::text]
  );

COMMENT ON COLUMN public.leads.services IS
  'Módulos contratados: landing, booking, inventory. Gobierna el sidebar del panel.';

-- =====================================================================
-- 3) Quién soy: resuelve el tenant desde la sesión
-- =====================================================================

-- SECURITY DEFINER porque las políticas de sites/products necesitan leer leads,
-- y leads no expone SELECT a authenticated (el cliente no ve su propia ficha de lead).
CREATE OR REPLACE FUNCTION public.current_lead_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id
  FROM public.leads l
  WHERE l.auth_user_id = auth.uid()
    AND l.status <> 'rejected'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_lead_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_lead_id() TO authenticated;

COMMENT ON FUNCTION public.current_lead_id() IS
  'Tenant de la sesión actual. NULL si el usuario no administra ningún negocio.';

-- Módulos contratados de la sesión. El backend los usa para autorizar rutas.
CREATE OR REPLACE FUNCTION public.current_lead_services()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.services
  FROM public.leads l
  WHERE l.auth_user_id = auth.uid()
    AND l.status <> 'rejected'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_lead_services() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_lead_services() TO authenticated;

-- =====================================================================
-- 4) Inventario del site
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  sku text NOT NULL,
  precio numeric(12, 2) NOT NULL DEFAULT 0,
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_nombre_len CHECK (length(trim(nombre)) BETWEEN 2 AND 120),
  CONSTRAINT products_sku_format CHECK (
    sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$' AND length(sku) BETWEEN 1 AND 40
  ),
  CONSTRAINT products_precio_range CHECK (precio >= 0 AND precio <= 99999999),
  CONSTRAINT products_stock_actual_nonneg CHECK (stock_actual >= 0),
  CONSTRAINT products_stock_minimo_nonneg CHECK (stock_minimo >= 0)
);

COMMENT ON TABLE public.products IS
  'Inventario de un site. El saldo solo se mueve con inventory_apply_movement().';
COMMENT ON COLUMN public.products.stock_actual IS
  'Saldo derivado de product_movements. Escritura directa bloqueada por trigger.';

CREATE UNIQUE INDEX IF NOT EXISTS products_site_sku_uidx
  ON public.products (site_id, lower(sku));
CREATE INDEX IF NOT EXISTS idx_products_site_nombre
  ON public.products (site_id, nombre);

CREATE TABLE IF NOT EXISTS public.product_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  stock_after integer NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_movements_delta_nonzero CHECK (delta <> 0),
  CONSTRAINT product_movements_stock_after_nonneg CHECK (stock_after >= 0)
);

COMMENT ON TABLE public.product_movements IS
  'Bitácora de entradas y salidas. Es la fuente de verdad de products.stock_actual.';

CREATE INDEX IF NOT EXISTS idx_product_movements_product_created_at
  ON public.product_movements (product_id, created_at DESC);

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 5) El saldo solo se mueve por la función
-- =====================================================================

CREATE OR REPLACE FUNCTION public.inventory_guard_stock_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.inventory_movement', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_actual IS DISTINCT FROM OLD.stock_actual THEN
    RAISE EXCEPTION 'stock_direct_write'
      USING HINT = 'Usa inventory_apply_movement() para mover el saldo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_guard_stock_write ON public.products;
CREATE TRIGGER products_guard_stock_write
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_stock_write();

-- Movimiento atómico: valida pertenencia al tenant, bloquea la fila y registra.
CREATE OR REPLACE FUNCTION public.inventory_apply_movement(
  p_product_id uuid,
  p_delta integer
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead_id uuid;
  v_product public.products;
  v_next integer;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta_zero';
  END IF;

  v_lead_id := public.current_lead_id();
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'no_tenant';
  END IF;

  SELECT p.* INTO v_product
  FROM public.products p
  JOIN public.sites s ON s.id = p.site_id
  WHERE p.id = p_product_id
    AND s.lead_id = v_lead_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  v_next := v_product.stock_actual + p_delta;
  IF v_next < 0 THEN
    RAISE EXCEPTION 'stock_negative';
  END IF;

  PERFORM set_config('app.inventory_movement', 'on', true);

  UPDATE public.products
  SET stock_actual = v_next
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  PERFORM set_config('app.inventory_movement', 'off', true);

  INSERT INTO public.product_movements (product_id, site_id, delta, stock_after, created_by)
  VALUES (p_product_id, v_product.site_id, p_delta, v_next, auth.uid());

  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_apply_movement(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_apply_movement(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.inventory_apply_movement(uuid, integer) IS
  'Única vía para mover stock. Valida tenant, evita saldo negativo y deja bitácora.';

-- =====================================================================
-- 6) RLS del panel: el cliente solo ve lo suyo
-- =====================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.products FROM anon, authenticated;
REVOKE ALL ON public.product_movements FROM anon, authenticated;

-- El cliente lee su ficha para que el panel muestre negocio y módulos.
-- Sin INSERT ni UPDATE: los datos de contacto y los servicios los cambia soporte.
GRANT SELECT (
  id,
  owner_name,
  business_name,
  email,
  phone,
  rubro,
  city,
  services,
  status,
  preview_slug,
  site_id,
  claimed_at,
  created_at
) ON public.leads TO authenticated;

-- El cliente edita el borrador de su site, no el snapshot publicado.
-- Publicar pasa por el servidor, que valida el contenido con Zod antes de copiarlo.
-- No puede crear ni borrar sites: eso nace del magnet y se archiva desde soporte.
GRANT SELECT ON public.sites TO authenticated;
GRANT UPDATE (title, content_json, lead_notify_email) ON public.sites TO authenticated;
GRANT SELECT ON public.site_inquiries TO authenticated;

-- stock_actual queda fuera de INSERT y UPDATE: el saldo solo lo mueve
-- inventory_apply_movement(). Así la bitácora nunca queda desfasada.
GRANT SELECT, DELETE ON public.products TO authenticated;
GRANT INSERT (site_id, nombre, sku, precio, stock_minimo) ON public.products TO authenticated;
GRANT UPDATE (nombre, sku, precio, stock_minimo) ON public.products TO authenticated;
GRANT SELECT ON public.product_movements TO authenticated;

GRANT USAGE ON TYPE public.lead_status TO authenticated;
GRANT USAGE ON TYPE public.site_status TO authenticated;
GRANT USAGE ON TYPE public.site_template TO authenticated;

-- auth_user_id = auth.uid() directo, no current_lead_id(), para no recursar
-- sobre esta misma política.
DROP POLICY IF EXISTS leads_owner_select ON public.leads;
CREATE POLICY leads_owner_select
  ON public.leads
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sites_owner_select ON public.sites;
CREATE POLICY sites_owner_select
  ON public.sites
  FOR SELECT TO authenticated
  USING (lead_id = public.current_lead_id());

DROP POLICY IF EXISTS sites_owner_update ON public.sites;
CREATE POLICY sites_owner_update
  ON public.sites
  FOR UPDATE TO authenticated
  USING (lead_id = public.current_lead_id())
  WITH CHECK (lead_id = public.current_lead_id());

DROP POLICY IF EXISTS site_inquiries_owner_select ON public.site_inquiries;
CREATE POLICY site_inquiries_owner_select
  ON public.site_inquiries
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s WHERE s.lead_id = public.current_lead_id()
    )
  );

DROP POLICY IF EXISTS products_owner_all ON public.products;
CREATE POLICY products_owner_all
  ON public.products
  FOR ALL TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s WHERE s.lead_id = public.current_lead_id()
    )
  )
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM public.sites s WHERE s.lead_id = public.current_lead_id()
    )
  );

DROP POLICY IF EXISTS product_movements_owner_select ON public.product_movements;
CREATE POLICY product_movements_owner_select
  ON public.product_movements
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s WHERE s.lead_id = public.current_lead_id()
    )
  );
