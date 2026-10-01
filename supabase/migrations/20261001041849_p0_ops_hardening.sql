-- P0 Superadmin hardening: drop legacy session RPCs, revoke anon, audit_logs, rate_limit.

-- =====================================================================
-- 1) Drop legacy overloads (anon-executable)
-- =====================================================================

DROP FUNCTION IF EXISTS public.create_user_session(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.update_session_activity(uuid, integer);

-- Canonical token-based session RPCs: service_role only
REVOKE ALL ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_session_activity(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(text, uuid)
  TO service_role;

-- Tenant helpers / inventory: no anon execute
REVOKE ALL ON FUNCTION public.current_lead_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_lead_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_lead_services() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_lead_services() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_vendor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_vendor_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.inventory_apply_movement(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_apply_movement(uuid, integer) TO authenticated, service_role;

-- =====================================================================
-- 2) audit_logs
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  resource_id uuid,
  ip_hash text,
  ua_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_len CHECK (length(trim(action)) BETWEEN 1 AND 80),
  CONSTRAINT audit_logs_resource_len CHECK (resource IS NULL OR length(trim(resource)) BETWEEN 1 AND 80),
  CONSTRAINT audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.audit_logs IS
  'Trail de acciones Superadmin/ops. Writes solo service role.';

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_at_idx
  ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx
  ON public.audit_logs (action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;

-- =====================================================================
-- 3) rate_limit_buckets + RPC
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  CONSTRAINT rate_limit_buckets_key_len CHECK (length(trim(key)) BETWEEN 1 AND 200),
  CONSTRAINT rate_limit_buckets_count_nonneg CHECK (count >= 0)
);

COMMENT ON TABLE public.rate_limit_buckets IS
  'Rate limit distribuido multi-réplica. Solo service role.';

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_window_ms integer,
  p_max integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := trim(p_key);
  v_now timestamptz := now();
  v_count integer;
  v_window interval;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_key IS NULL OR length(v_key) < 1 OR length(v_key) > 200 THEN
    RAISE EXCEPTION 'invalid_key';
  END IF;

  IF p_window_ms IS NULL OR p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'invalid_window';
  END IF;

  IF p_max IS NULL OR p_max < 1 OR p_max > 100000 THEN
    RAISE EXCEPTION 'invalid_max';
  END IF;

  v_window := make_interval(secs => p_window_ms::numeric / 1000.0);

  LOOP
    UPDATE public.rate_limit_buckets
    SET
      count = CASE WHEN reset_at <= v_now THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= v_now THEN v_now + v_window ELSE reset_at END
    WHERE key = v_key
    RETURNING count INTO v_count;

    IF FOUND THEN
      RETURN v_count <= p_max;
    END IF;

    BEGIN
      INSERT INTO public.rate_limit_buckets (key, count, reset_at)
      VALUES (v_key, 1, v_now + v_window);
      RETURN true;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
