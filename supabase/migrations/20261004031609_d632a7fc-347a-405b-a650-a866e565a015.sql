REVOKE ALL ON public.class_sessions FROM anon;
REVOKE EXECUTE ON FUNCTION public.session_has_attendance(uuid, date) FROM authenticated;