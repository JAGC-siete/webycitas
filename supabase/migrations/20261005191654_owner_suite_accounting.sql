-- Owner suite Contabilidad (MVP núcleo): plan de cuentas + asientos partida doble.
-- Tenant = sites.site_id vía leads; sin company_id. Montos en cents (HNL).

-- =====================================================================
-- 1) Servicio contratable accounting
-- =====================================================================

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_services_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_services_check CHECK (
    cardinality(services) BETWEEN 1 AND 4
    AND services <@ ARRAY['landing'::text, 'booking'::text, 'inventory'::text, 'accounting'::text]
  );

COMMENT ON COLUMN public.leads.services IS
  'Módulos contratados: landing, booking, inventory, accounting. Gobierna el sidebar del panel.';

-- =====================================================================
-- 2) Enums
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.accounting_account_type AS ENUM (
    'asset', 'liability', 'equity', 'revenue', 'expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.accounting_normal_balance AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.accounting_entry_status AS ENUM ('draft', 'posted', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 3) Tables
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type public.accounting_account_type NOT NULL,
  normal_balance public.accounting_normal_balance NOT NULL,
  parent_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  is_postable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_accounts_code_len CHECK (length(trim(code)) BETWEEN 1 AND 32),
  CONSTRAINT accounting_accounts_name_len CHECK (length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT accounting_accounts_normal_by_type CHECK (
    (account_type IN ('asset', 'expense') AND normal_balance = 'debit')
    OR (account_type IN ('liability', 'equity', 'revenue') AND normal_balance = 'credit')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_accounts_site_code_uidx
  ON public.accounting_accounts (site_id, code);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_site_parent
  ON public.accounting_accounts (site_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_site_type
  ON public.accounting_accounts (site_id, account_type);

COMMENT ON TABLE public.accounting_accounts IS
  'Plan de cuentas por site. Solo hojas is_postable reciben líneas de asiento.';

CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text NOT NULL,
  status public.accounting_entry_status NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'manual',
  reverses_entry_id uuid REFERENCES public.accounting_journal_entries(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_journal_entries_description_len CHECK (
    length(trim(description)) BETWEEN 1 AND 500
  ),
  CONSTRAINT accounting_journal_entries_source_len CHECK (
    length(trim(source)) BETWEEN 1 AND 40
  )
);

CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_site_date
  ON public.accounting_journal_entries (site_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_site_status
  ON public.accounting_journal_entries (site_id, status);

COMMENT ON TABLE public.accounting_journal_entries IS
  'Cabecera de asiento. Posted/reversed son append-only; correcciones vía reverso.';

CREATE TABLE IF NOT EXISTS public.accounting_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.accounting_journal_entries(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  line_no integer NOT NULL,
  debit_cents integer NOT NULL DEFAULT 0,
  credit_cents integer NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_journal_lines_line_no_pos CHECK (line_no >= 1),
  CONSTRAINT accounting_journal_lines_amounts_nonneg CHECK (
    debit_cents >= 0 AND credit_cents >= 0
    AND debit_cents <= 999999999999
    AND credit_cents <= 999999999999
  ),
  CONSTRAINT accounting_journal_lines_xor_amount CHECK (
    (debit_cents > 0 AND credit_cents = 0)
    OR (credit_cents > 0 AND debit_cents = 0)
  ),
  CONSTRAINT accounting_journal_lines_memo_len CHECK (
    memo IS NULL OR length(trim(memo)) BETWEEN 1 AND 240
  ),
  CONSTRAINT accounting_journal_lines_entry_line_uidx UNIQUE (entry_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry
  ON public.accounting_journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account
  ON public.accounting_journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_site
  ON public.accounting_journal_lines (site_id);

COMMENT ON TABLE public.accounting_journal_lines IS
  'Líneas de débito/crédito. XOR: exactamente un lado > 0.';

-- =====================================================================
-- 4) Triggers: updated_at, parent same site/type, immutability
-- =====================================================================

DROP TRIGGER IF EXISTS accounting_accounts_set_updated_at ON public.accounting_accounts;
CREATE TRIGGER accounting_accounts_set_updated_at
  BEFORE UPDATE ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS accounting_journal_entries_set_updated_at ON public.accounting_journal_entries;
CREATE TRIGGER accounting_journal_entries_set_updated_at
  BEFORE UPDATE ON public.accounting_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.accounting_account_parent_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent public.accounting_accounts;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'account_parent_self';
  END IF;

  SELECT * INTO v_parent
  FROM public.accounting_accounts
  WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_parent_missing';
  END IF;

  IF v_parent.site_id IS DISTINCT FROM NEW.site_id THEN
    RAISE EXCEPTION 'account_parent_site_mismatch';
  END IF;

  IF v_parent.account_type IS DISTINCT FROM NEW.account_type THEN
    RAISE EXCEPTION 'account_parent_type_mismatch';
  END IF;

  IF v_parent.is_postable THEN
    RAISE EXCEPTION 'account_parent_must_not_be_postable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_accounts_parent_guard ON public.accounting_accounts;
CREATE TRIGGER accounting_accounts_parent_guard
  BEFORE INSERT OR UPDATE OF parent_id, site_id, account_type ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_account_parent_guard();

CREATE OR REPLACE FUNCTION public.accounting_mutation_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(nullif(current_setting('app.accounting_mutation', true), ''), 'off') = 'on';
$$;

CREATE OR REPLACE FUNCTION public.accounting_entries_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.accounting_mutation_allowed() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'entry_immutable'
        USING HINT = 'Usa accounting_reverse_journal_entry() para corregir.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'entry_immutable'
      USING HINT = 'Usa accounting_reverse_journal_entry() para corregir.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_journal_entries_immutable ON public.accounting_journal_entries;
CREATE TRIGGER accounting_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON public.accounting_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.accounting_entries_immutable();

CREATE OR REPLACE FUNCTION public.accounting_lines_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.accounting_entry_status;
  v_entry_id uuid;
BEGIN
  IF public.accounting_mutation_allowed() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END;

  SELECT e.status INTO v_status
  FROM public.accounting_journal_entries e
  WHERE e.id = v_entry_id;

  IF v_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'entry_lines_immutable'
      USING HINT = 'Los asientos publicados no se editan; genera un reverso.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_journal_lines_immutable ON public.accounting_journal_lines;
CREATE TRIGGER accounting_journal_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_lines_immutable();

CREATE OR REPLACE FUNCTION public.accounting_line_account_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.accounting_accounts;
BEGIN
  SELECT * INTO v_account
  FROM public.accounting_accounts
  WHERE id = NEW.account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found';
  END IF;

  IF v_account.site_id IS DISTINCT FROM NEW.site_id THEN
    RAISE EXCEPTION 'account_site_mismatch';
  END IF;

  IF NOT v_account.is_postable OR NOT v_account.is_active THEN
    RAISE EXCEPTION 'account_not_postable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_journal_lines_account_guard ON public.accounting_journal_lines;
CREATE TRIGGER accounting_journal_lines_account_guard
  BEFORE INSERT OR UPDATE OF account_id, site_id ON public.accounting_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_line_account_guard();

-- =====================================================================
-- 5) RPCs: seed COA, post, reverse
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accounting_seed_default_coa(p_site_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer := 0;
  v_row record;
  v_parent_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.suite_owns_site(p_site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  -- Padres (no postables)
  FOR v_row IN
    SELECT * FROM (VALUES
      ('1000', 'Activos', 'asset'::public.accounting_account_type, 'debit'::public.accounting_normal_balance, false),
      ('2000', 'Pasivos', 'liability', 'credit', false),
      ('3000', 'Patrimonio', 'equity', 'credit', false),
      ('4000', 'Ingresos', 'revenue', 'credit', false),
      ('5000', 'Gastos', 'expense', 'debit', false)
    ) AS t(code, name, account_type, normal_balance, is_postable)
  LOOP
    INSERT INTO public.accounting_accounts (
      site_id, code, name, account_type, normal_balance, parent_id, is_postable, is_active
    )
    VALUES (
      p_site_id, v_row.code, v_row.name, v_row.account_type, v_row.normal_balance, NULL, v_row.is_postable, true
    )
    ON CONFLICT (site_id, code) DO NOTHING;
    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- Hojas postables
  FOR v_row IN
    SELECT * FROM (VALUES
      ('1100', 'Caja', 'asset'::public.accounting_account_type, 'debit'::public.accounting_normal_balance, '1000'),
      ('1200', 'Bancos', 'asset', 'debit', '1000'),
      ('1300', 'Cuentas por cobrar', 'asset', 'debit', '1000'),
      ('2100', 'Cuentas por pagar', 'liability', 'credit', '2000'),
      ('3100', 'Capital', 'equity', 'credit', '3000'),
      ('3200', 'Resultados del ejercicio', 'equity', 'credit', '3000'),
      ('4100', 'Ingresos por servicios', 'revenue', 'credit', '4000'),
      ('4200', 'Otros ingresos', 'revenue', 'credit', '4000'),
      ('5100', 'Gastos operativos', 'expense', 'debit', '5000'),
      ('5200', 'Gastos administrativos', 'expense', 'debit', '5000')
    ) AS t(code, name, account_type, normal_balance, parent_code)
  LOOP
    SELECT id INTO v_parent_id
    FROM public.accounting_accounts
    WHERE site_id = p_site_id AND code = v_row.parent_code;

    v_id := NULL;
    INSERT INTO public.accounting_accounts (
      site_id, code, name, account_type, normal_balance, parent_id, is_postable, is_active
    )
    VALUES (
      p_site_id, v_row.code, v_row.name, v_row.account_type, v_row.normal_balance, v_parent_id, true, true
    )
    ON CONFLICT (site_id, code) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_seed_default_coa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_seed_default_coa(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.accounting_seed_default_coa(uuid) IS
  'Plantilla mínima HNL por site. Idempotente por (site_id, code).';

CREATE OR REPLACE FUNCTION public.accounting_post_journal_entry(p_entry_id uuid)
RETURNS public.accounting_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry public.accounting_journal_entries;
  v_debits bigint;
  v_credits bigint;
  v_lines integer;
BEGIN
  SELECT * INTO v_entry
  FROM public.accounting_journal_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF NOT public.suite_owns_site(v_entry.site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_entry.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'entry_not_draft';
  END IF;

  SELECT COUNT(*)::int,
         COALESCE(SUM(debit_cents), 0)::bigint,
         COALESCE(SUM(credit_cents), 0)::bigint
  INTO v_lines, v_debits, v_credits
  FROM public.accounting_journal_lines
  WHERE entry_id = p_entry_id;

  IF v_lines < 2 THEN
    RAISE EXCEPTION 'entry_needs_two_lines';
  END IF;

  IF v_debits = 0 OR v_credits = 0 OR v_debits <> v_credits THEN
    RAISE EXCEPTION 'entry_unbalanced'
      USING HINT = 'La suma de débitos debe igualar la suma de créditos.';
  END IF;

  PERFORM set_config('app.accounting_mutation', 'on', true);

  UPDATE public.accounting_journal_entries
  SET status = 'posted',
      posted_at = now(),
      posted_by = auth.uid()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  PERFORM set_config('app.accounting_mutation', 'off', true);

  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_post_journal_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_post_journal_entry(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.accounting_post_journal_entry(uuid) IS
  'Publica un draft solo si está balanceado (≥2 líneas, Σ débito = Σ crédito).';

CREATE OR REPLACE FUNCTION public.accounting_reverse_journal_entry(
  p_entry_id uuid,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_description text DEFAULT NULL
)
RETURNS public.accounting_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original public.accounting_journal_entries;
  v_reverse public.accounting_journal_entries;
  v_line public.accounting_journal_lines;
  v_desc text;
BEGIN
  SELECT * INTO v_original
  FROM public.accounting_journal_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF NOT public.suite_owns_site(v_original.site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_original.status IS DISTINCT FROM 'posted' THEN
    RAISE EXCEPTION 'entry_not_posted';
  END IF;

  v_desc := COALESCE(
    nullif(trim(p_description), ''),
    'Reverso de: ' || left(v_original.description, 450)
  );

  PERFORM set_config('app.accounting_mutation', 'on', true);

  INSERT INTO public.accounting_journal_entries (
    site_id, entry_date, description, status, source,
    reverses_entry_id, posted_at, posted_by, created_by
  )
  VALUES (
    v_original.site_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    v_desc,
    'posted',
    'reversal',
    v_original.id,
    now(),
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO v_reverse;

  FOR v_line IN
    SELECT * FROM public.accounting_journal_lines
    WHERE entry_id = v_original.id
    ORDER BY line_no
  LOOP
    INSERT INTO public.accounting_journal_lines (
      entry_id, site_id, account_id, line_no, debit_cents, credit_cents, memo
    )
    VALUES (
      v_reverse.id,
      v_line.site_id,
      v_line.account_id,
      v_line.line_no,
      v_line.credit_cents,
      v_line.debit_cents,
      v_line.memo
    );
  END LOOP;

  UPDATE public.accounting_journal_entries
  SET status = 'reversed'
  WHERE id = v_original.id;

  PERFORM set_config('app.accounting_mutation', 'off', true);

  RETURN v_reverse;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_reverse_journal_entry(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_reverse_journal_entry(uuid, date, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.accounting_reverse_journal_entry(uuid, date, text) IS
  'Crea asiento espejo posted e marca el original como reversed. Append-only.';

-- =====================================================================
-- 6) RLS
-- =====================================================================

ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.accounting_accounts FROM anon, authenticated;
REVOKE ALL ON public.accounting_journal_entries FROM anon, authenticated;
REVOKE ALL ON public.accounting_journal_lines FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_journal_lines TO authenticated;

CREATE POLICY accounting_accounts_owner_all ON public.accounting_accounts
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY accounting_journal_entries_owner_all ON public.accounting_journal_entries
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));

CREATE POLICY accounting_journal_lines_owner_all ON public.accounting_journal_lines
  FOR ALL TO authenticated
  USING (public.suite_owns_site(site_id))
  WITH CHECK (public.suite_owns_site(site_id));
