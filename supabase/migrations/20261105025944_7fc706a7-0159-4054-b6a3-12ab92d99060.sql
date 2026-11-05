-- Stop a class going forward: closes every open timetable period so no future sessions are generated.
CREATE OR REPLACE FUNCTION public.stop_class_schedule(_class_id uuid, _from date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_co_admin()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id) THEN RAISE EXCEPTION 'Class not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_schedules WHERE class_id = _class_id AND effective_from < _from) THEN
    RAISE EXCEPTION 'Pick a date after this class''s timetable started';
  END IF;
  DELETE FROM public.class_schedules WHERE class_id = _class_id AND effective_from >= _from;
  UPDATE public.class_schedules SET effective_to = _from - 1
   WHERE class_id = _class_id AND effective_from < _from AND (effective_to IS NULL OR effective_to >= _from);
END $$;
REVOKE EXECUTE ON FUNCTION public.stop_class_schedule(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_class_schedule(uuid, date) TO authenticated;

-- A cancel or reschedule must target a date where the class really has a scheduled session.
-- Extra sessions may still be added on any date.
CREATE OR REPLACE FUNCTION public.validate_schedule_exception() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d date;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.type NOT IN ('cancelled','rescheduled','extra') THEN RAISE EXCEPTION 'Invalid exception type'; END IF;
    IF NEW.type = 'rescheduled' AND NEW.new_date IS NULL THEN RAISE EXCEPTION 'A rescheduled session needs a new date'; END IF;
    IF NEW.type IN ('cancelled','rescheduled') AND NOT EXISTS (
         SELECT 1 FROM public.class_sessions
          WHERE class_id = NEW.class_id AND session_date = NEW.date AND status = 'scheduled') THEN
      RAISE EXCEPTION 'No scheduled session on % for this class; pick a date the class actually meets', NEW.date;
    END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    FOR d IN SELECT x FROM unnest(ARRAY[CASE WHEN TG_OP<>'DELETE' THEN NEW.date END, CASE WHEN TG_OP<>'DELETE' THEN NEW.new_date END,
                                       CASE WHEN TG_OP<>'INSERT' THEN OLD.date END, CASE WHEN TG_OP<>'INSERT' THEN OLD.new_date END]) x WHERE x IS NOT NULL LOOP
      IF public.is_date_frozen(d) THEN RAISE EXCEPTION 'Date % is in a frozen financial year; only the admin can change it', d; END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;