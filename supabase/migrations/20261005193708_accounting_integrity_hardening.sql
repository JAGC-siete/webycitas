-- Contabilidad integrity hardening:
-- 1) Lock status transitions to mutation flag
-- 2) line.site_id must equal entry.site_id
-- 3) Atomic draft upsert RPC
-- 4) Aggregated report RPC (avoids PostgREST max_rows truncation)

-- =====================================================================
-- 1) Stronger entry immutability: status only via mutation flag
-- =====================================================================

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

  -- Draft updates OK except status (must go through RPCs).
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'entry_status_locked'
      USING HINT = 'Usa accounting_post_journal_entry() o accounting_reverse_journal_entry().';
  END IF;

  IF OLD.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'entry_immutable'
      USING HINT = 'Usa accounting_reverse_journal_entry() para corregir.';
  END IF;

  -- Freeze audit fields on drafts too (except via mutation flag).
  IF NEW.posted_at IS DISTINCT FROM OLD.posted_at
     OR NEW.posted_by IS DISTINCT FROM OLD.posted_by
     OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'entry_audit_locked';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================================
-- 2) line.site_id = entry.site_id
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accounting_line_entry_site_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_site uuid;
BEGIN
  SELECT e.site_id INTO v_entry_site
  FROM public.accounting_journal_entries e
  WHERE e.id = NEW.entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF v_entry_site IS DISTINCT FROM NEW.site_id THEN
    RAISE EXCEPTION 'line_entry_site_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_journal_lines_entry_site_guard ON public.accounting_journal_lines;
CREATE TRIGGER accounting_journal_lines_entry_site_guard
  BEFORE INSERT OR UPDATE OF entry_id, site_id ON public.accounting_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_line_entry_site_guard();

-- =====================================================================
-- 3) Atomic draft create / replace
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accounting_upsert_draft_entry(
  p_site_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb,
  p_entry_id uuid DEFAULT NULL
)
RETURNS public.accounting_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry public.accounting_journal_entries;
  v_line jsonb;
  v_idx integer := 0;
  v_debit integer;
  v_credit integer;
BEGIN
  IF NOT public.suite_owns_site(p_site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) < 1 OR length(trim(p_description)) > 500 THEN
    RAISE EXCEPTION 'invalid_description';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'entry_needs_two_lines';
  END IF;

  IF p_entry_id IS NULL THEN
    INSERT INTO public.accounting_journal_entries (
      site_id, entry_date, description, status, source, created_by
    )
    VALUES (
      p_site_id, p_entry_date, trim(p_description), 'draft', 'manual', auth.uid()
    )
    RETURNING * INTO v_entry;
  ELSE
    SELECT * INTO v_entry
    FROM public.accounting_journal_entries
    WHERE id = p_entry_id
      AND site_id = p_site_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'entry_not_found';
    END IF;

    IF v_entry.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'entry_not_draft';
    END IF;

    UPDATE public.accounting_journal_entries
    SET entry_date = p_entry_date,
        description = trim(p_description)
    WHERE id = p_entry_id
    RETURNING * INTO v_entry;

    DELETE FROM public.accounting_journal_lines
    WHERE entry_id = p_entry_id
      AND site_id = p_site_id;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_idx := v_idx + 1;
    v_debit := COALESCE((v_line->>'debit_cents')::integer, 0);
    v_credit := COALESCE((v_line->>'credit_cents')::integer, 0);

    IF NOT ((v_debit > 0 AND v_credit = 0) OR (v_credit > 0 AND v_debit = 0)) THEN
      RAISE EXCEPTION 'line_xor_invalid';
    END IF;

    INSERT INTO public.accounting_journal_lines (
      entry_id, site_id, account_id, line_no, debit_cents, credit_cents, memo
    )
    VALUES (
      v_entry.id,
      p_site_id,
      (v_line->>'account_id')::uuid,
      v_idx,
      v_debit,
      v_credit,
      NULLIF(trim(COALESCE(v_line->>'memo', '')), '')
    );
  END LOOP;

  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_upsert_draft_entry(uuid, date, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_upsert_draft_entry(uuid, date, text, jsonb, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.accounting_upsert_draft_entry(uuid, date, text, jsonb, uuid) IS
  'Crea o reemplaza un draft de forma atómica. No exige balance (sí en post).';

-- =====================================================================
-- 4) Report aggregates in SQL
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accounting_report_line_aggs(
  p_site_id uuid,
  p_as_of date DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_types public.accounting_account_type[] DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  code text,
  name text,
  account_type public.accounting_account_type,
  normal_balance public.accounting_normal_balance,
  debit_cents bigint,
  credit_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.suite_owns_site(p_site_id)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.code,
    a.name,
    a.account_type,
    a.normal_balance,
    COALESCE(SUM(l.debit_cents), 0)::bigint AS debit_cents,
    COALESCE(SUM(l.credit_cents), 0)::bigint AS credit_cents
  FROM public.accounting_journal_lines l
  JOIN public.accounting_journal_entries e ON e.id = l.entry_id
  JOIN public.accounting_accounts a ON a.id = l.account_id
  WHERE l.site_id = p_site_id
    AND e.site_id = p_site_id
    AND e.status = 'posted'
    AND (p_as_of IS NULL OR e.entry_date <= p_as_of)
    AND (p_from IS NULL OR e.entry_date >= p_from)
    AND (p_to IS NULL OR e.entry_date <= p_to)
    AND (p_types IS NULL OR a.account_type = ANY (p_types))
  GROUP BY a.id, a.code, a.name, a.account_type, a.normal_balance
  HAVING COALESCE(SUM(l.debit_cents), 0) <> 0 OR COALESCE(SUM(l.credit_cents), 0) <> 0
  ORDER BY a.code;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_report_line_aggs(uuid, date, date, date, public.accounting_account_type[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_report_line_aggs(uuid, date, date, date, public.accounting_account_type[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.accounting_report_line_aggs(uuid, date, date, date, public.accounting_account_type[]) IS
  'Agrega líneas posted por cuenta. Evita truncado PostgREST max_rows.';
