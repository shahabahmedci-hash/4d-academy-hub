
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS reconciliation text;

CREATE OR REPLACE FUNCTION public.range_has_frozen(_from date, _to date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.financial_years WHERE is_frozen AND start_date <= _to AND end_date >= _from);
$$;
REVOKE EXECUTE ON FUNCTION public.range_has_frozen(date, date) FROM PUBLIC, anon, authenticated;

-- Attendance is now protected per session (sessions with attendance are never removed), so
-- backdated timetable changes are allowed. Frozen financial years stay locked except for the main admin.
CREATE OR REPLACE FUNCTION public.protect_schedule_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f date;
BEGIN
  IF TG_OP = 'DELETE' THEN f := OLD.effective_from;
  ELSE f := LEAST(OLD.effective_from, NEW.effective_from, COALESCE(NEW.effective_to + 1, NEW.effective_from), COALESCE(OLD.effective_to + 1, OLD.effective_from)); END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND f <= CURRENT_DATE AND public.range_has_frozen(f, CURRENT_DATE) THEN
    RAISE EXCEPTION 'This change reaches into a frozen financial year; only the admin can change it';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_schedule_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND NEW.effective_from <= CURRENT_DATE
     AND public.range_has_frozen(NEW.effective_from, LEAST(COALESCE(NEW.effective_to, CURRENT_DATE), CURRENT_DATE)) THEN
    RAISE EXCEPTION 'This schedule starts inside a frozen financial year; only the admin can add it';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_schedule_insert_trg ON public.class_schedules;
CREATE TRIGGER protect_schedule_insert_trg BEFORE INSERT ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.protect_schedule_insert();

CREATE OR REPLACE FUNCTION public.validate_schedule_exception() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d date;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.type NOT IN ('cancelled','rescheduled','extra') THEN RAISE EXCEPTION 'Invalid exception type'; END IF;
    IF NEW.type = 'rescheduled' AND NEW.new_date IS NULL THEN RAISE EXCEPTION 'A rescheduled session needs a new date'; END IF;
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
DROP TRIGGER IF EXISTS validate_schedule_exception_trg ON public.schedule_exceptions;
DROP TRIGGER IF EXISTS validate_schedule_exception ON public.schedule_exceptions;
CREATE TRIGGER validate_schedule_exception_trg BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_exception();

CREATE OR REPLACE FUNCTION public.validate_holiday_freeze() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF (TG_OP <> 'DELETE' AND public.is_date_frozen(NEW.date)) OR (TG_OP <> 'INSERT' AND public.is_date_frozen(OLD.date)) THEN
      RAISE EXCEPTION 'This date is in a frozen financial year; only the admin can change it';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_holiday_freeze_trg ON public.holidays;
CREATE TRIGGER validate_holiday_freeze_trg BEFORE INSERT OR UPDATE OR DELETE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.validate_holiday_freeze();

-- Generator: never removes or alters a session that has attendance. If the schedule no longer
-- produces such a session, it is kept and flagged 'kept_with_attendance'.
CREATE OR REPLACE FUNCTION public.generate_class_sessions(_class_id uuid, _from date, _to date, _include_past boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f date := CASE WHEN _include_past THEN _from ELSE GREATEST(_from, CURRENT_DATE) END;
BEGIN
  IF f > _to THEN RETURN; END IF;
  DELETE FROM public.class_sessions s
   WHERE (_class_id IS NULL OR s.class_id = _class_id) AND s.session_date BETWEEN f AND _to
     AND NOT public.session_has_attendance(s.class_id, s.session_date);
  INSERT INTO public.class_sessions (class_id, section, session_date, start_time, end_time, status, kind, schedule_id, exception_id, rescheduled_to_date, created_by)
  SELECT DISTINCT ON (x.class_id, x.session_date, x.start_time)
    x.class_id, c.section, x.session_date, x.start_time, x.end_time, x.status, x.kind, x.schedule_id, x.exception_id, x.rescheduled_to_date, auth.uid()
  FROM public.compute_class_sessions(f, _to, _class_id) x JOIN public.classes c ON c.id = x.class_id
  WHERE NOT EXISTS (SELECT 1 FROM public.class_sessions k WHERE k.class_id = x.class_id AND k.session_date = x.session_date)
  ORDER BY x.class_id, x.session_date, x.start_time, (x.status = 'scheduled') DESC
  ON CONFLICT (class_id, session_date, start_time) DO NOTHING;
  UPDATE public.class_sessions s SET reconciliation =
    CASE WHEN EXISTS (SELECT 1 FROM public.compute_class_sessions(s.session_date, s.session_date, s.class_id) x
                      WHERE x.status = s.status AND x.start_time = s.start_time AND x.end_time = s.end_time) THEN NULL
         ELSE 'kept_with_attendance' END
   WHERE (_class_id IS NULL OR s.class_id = _class_id) AND s.session_date BETWEEN f AND _to
     AND public.session_has_attendance(s.class_id, s.session_date);
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_class_sessions(uuid, date, date, boolean) FROM PUBLIC, anon, authenticated;

-- Schedule edits regenerate from their effective date (backdated changes included).
CREATE OR REPLACE FUNCTION public.sessions_on_schedule_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; f date;
BEGIN
  IF TG_OP = 'DELETE' THEN cid := OLD.class_id; f := OLD.effective_from;
  ELSIF TG_OP = 'UPDATE' THEN cid := NEW.class_id; f := LEAST(OLD.effective_from, NEW.effective_from, COALESCE(OLD.effective_to + 1, NEW.effective_from), COALESCE(NEW.effective_to + 1, NEW.effective_from));
  ELSE cid := NEW.class_id; f := NEW.effective_from; END IF;
  PERFORM public.generate_class_sessions(cid, f, CURRENT_DATE + 90, true);
  RETURN NULL;
END $$;

-- Impact preview for a timetable change from a date (no changes made).
CREATE OR REPLACE FUNCTION public.preview_schedule_change(_class_id uuid, _effective_from date, _slots jsonb)
RETURNS TABLE(session_date date, action text, old_time text, new_time text, attendance_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_co_admin()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  WITH newset AS (
    SELECT d::date AS dt, min((s->>'start_time')::time) st, min((s->>'end_time')::time) et
    FROM jsonb_array_elements(_slots) s
    CROSS JOIN LATERAL generate_series(_effective_from, CURRENT_DATE + 90, interval '1 day') d
    WHERE extract(dow FROM d)::int = (s->>'day_of_week')::int
      AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = d::date)
      AND NOT EXISTS (SELECT 1 FROM public.schedule_exceptions e WHERE e.class_id = _class_id AND e.date = d::date AND e.type IN ('cancelled','rescheduled'))
    GROUP BY d::date
  ), oldset AS (
    SELECT cs.session_date AS dt, min(cs.start_time) st, min(cs.end_time) et
    FROM public.class_sessions cs
    WHERE cs.class_id = _class_id AND cs.kind = 'regular' AND cs.status = 'scheduled' AND cs.session_date >= _effective_from
    GROUP BY cs.session_date
  ), j AS (
    SELECT COALESCE(n.dt, o.dt) dt, o.st ost, o.et oet, n.st nst, n.et net FROM newset n FULL JOIN oldset o ON o.dt = n.dt
  )
  SELECT j.dt,
    CASE WHEN j.ost IS NULL THEN 'add'
         WHEN j.nst IS NULL THEN CASE WHEN a.cnt > 0 THEN 'kept_with_attendance' ELSE 'remove' END
         WHEN j.ost <> j.nst OR j.oet <> j.net THEN CASE WHEN a.cnt > 0 THEN 'kept_with_attendance' ELSE 'time_change' END
         ELSE 'unchanged' END,
    CASE WHEN j.ost IS NULL THEN NULL ELSE to_char(j.ost,'HH24:MI')||'–'||to_char(j.oet,'HH24:MI') END,
    CASE WHEN j.nst IS NULL THEN NULL ELSE to_char(j.nst,'HH24:MI')||'–'||to_char(j.net,'HH24:MI') END,
    a.cnt
  FROM j CROSS JOIN LATERAL (
    SELECT ((SELECT count(*) FROM public.attendance x WHERE x.class_id = _class_id AND x.date = j.dt)
          + (SELECT count(*) FROM public.teacher_attendance x WHERE x.class_id = _class_id AND x.date = j.dt))::int AS cnt) a
  ORDER BY j.dt;
END $$;
REVOKE EXECUTE ON FUNCTION public.preview_schedule_change(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_schedule_change(uuid, date, jsonb) TO authenticated;
