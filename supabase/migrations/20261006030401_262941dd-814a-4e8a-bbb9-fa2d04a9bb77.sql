REVOKE EXECUTE ON FUNCTION public.protect_schedule_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_holiday_freeze() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_schedule_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sessions_on_schedule_change() FROM PUBLIC, anon, authenticated;