-- Fix: first hit was counted twice (INSERT count=1 then UPDATE +1).

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
