-- Login unificado Webycitas. Proyecto propio. Sin company_id, sin roles de HR.

-- =====================================================================
-- 1) Perfil: autorización
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_role_check CHECK (role IN ('super_admin', 'owner')),
  CONSTRAINT user_profiles_permissions_object CHECK (jsonb_typeof(permissions) = 'object')
);

COMMENT ON TABLE public.user_profiles IS
  'Autorización de Webycitas. role=super_admin (ops) u owner (dueño de lead). Writes solo service role.';

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_profiles FROM anon, authenticated;
GRANT SELECT (id, role, is_active, permissions, created_at, updated_at) ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS user_profiles_self_select ON public.user_profiles;
CREATE POLICY user_profiles_self_select
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- =====================================================================
-- 2) Sesiones: TTL 12 h, idle 90 min
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  ip_hash text,
  ua_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  idle_timeout_at timestamptz NOT NULL,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_sessions_token_len CHECK (length(session_token) BETWEEN 32 AND 128),
  CONSTRAINT user_sessions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.user_sessions IS
  'Sesión de app (idle 90 min / TTL 12 h). session_token es hash, no el JWT.';

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_uidx
  ON public.user_sessions (session_token);
CREATE INDEX IF NOT EXISTS user_sessions_user_last_activity_idx
  ON public.user_sessions (user_id, last_activity DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_sessions FROM anon, authenticated;
GRANT SELECT (
  id,
  user_id,
  created_at,
  last_activity,
  expires_at,
  idle_timeout_at,
  revoked_at
) ON public.user_sessions TO authenticated;

DROP POLICY IF EXISTS user_sessions_self_select ON public.user_sessions;
CREATE POLICY user_sessions_self_select
  ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND revoked_at IS NULL);

-- =====================================================================
-- 3) RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_user_session(
  p_user_id uuid,
  p_session_token text,
  p_ip_hash text DEFAULT NULL,
  p_ua_hash text DEFAULT NULL,
  p_access_token_ttl_seconds integer DEFAULT 43200,
  p_idle_timeout_minutes integer DEFAULT 90
)
RETURNS public.user_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.user_sessions;
  v_ttl integer := COALESCE(p_access_token_ttl_seconds, 43200);
  v_idle integer := COALESCE(p_idle_timeout_minutes, 90);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_user_id IS NULL OR length(trim(p_session_token)) < 32 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  IF v_ttl < 60 OR v_ttl > 86400 THEN
    RAISE EXCEPTION 'invalid_ttl';
  END IF;

  IF v_idle < 5 OR v_idle > 720 THEN
    RAISE EXCEPTION 'invalid_idle';
  END IF;

  INSERT INTO public.user_sessions (
    user_id,
    session_token,
    ip_hash,
    ua_hash,
    expires_at,
    idle_timeout_at
  ) VALUES (
    p_user_id,
    trim(p_session_token),
    NULLIF(trim(COALESCE(p_ip_hash, '')), ''),
    NULLIF(trim(COALESCE(p_ua_hash, '')), ''),
    now() + make_interval(secs => v_ttl),
    now() + make_interval(mins => v_idle)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_session_token text,
  p_user_id uuid
)
RETURNS public.user_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.user_sessions;
  v_idle interval := interval '90 minutes';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT * INTO v_row
  FROM public.user_sessions
  WHERE session_token = trim(p_session_token)
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'session_revoked';
  END IF;

  IF v_row.expires_at <= now() OR v_row.idle_timeout_at <= now() THEN
    UPDATE public.user_sessions
    SET revoked_at = now()
    WHERE id = v_row.id;
    RAISE EXCEPTION 'session_expired';
  END IF;

  UPDATE public.user_sessions
  SET
    last_activity = now(),
    idle_timeout_at = now() + v_idle
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_session_activity(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_session_activity(text, uuid) TO authenticated, service_role;
