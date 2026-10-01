REVOKE ALL ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_session_activity(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_session(uuid, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_session_activity(text, uuid) TO authenticated, service_role;
