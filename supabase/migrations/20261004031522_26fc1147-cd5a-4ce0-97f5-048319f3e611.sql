
CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  kind text NOT NULL DEFAULT 'regular',
  schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL,
  exception_id uuid REFERENCES public.schedule_exceptions(id) ON DELETE SET NULL,
  rescheduled_to_date date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, session_date, start_time)
);
GRANT SELECT ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sessions" ON public.class_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sessions" ON public.class_sessions FOR ALL TO authenticated USING (is_admin() OR is_co_admin()) WITH CHECK (is_admin() OR is_co_admin());
CREATE INDEX class_sessions_date_idx ON public.class_sessions (session_date, class_id);

CREATE OR REPLACE FUNCTION public.validate_class_session() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('scheduled','cancelled','rescheduled') THEN RAISE EXCEPTION 'Invalid session status'; END IF;
  IF NEW.kind NOT IN ('regular','extra','rescheduled_to') THEN RAISE EXCEPTION 'Invalid session kind'; END IF;
  IF NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN NEW.updated_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_class_session_trg BEFORE INSERT OR UPDATE ON public.class_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_class_session();

CREATE OR REPLACE FUNCTION public.session_has_attendance(_class_id uuid, _date date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.attendance WHERE class_id = _class_id AND date = _date)
      OR EXISTS (SELECT 1 FROM public.teacher_attendance WHERE class_id = _class_id AND date = _date);
$$;

-- Pure expansion of the timetable effective on each date (+ exceptions, holidays). Used only to generate stored sessions.
CREATE OR REPLACE FUNCTION public.compute_class_sessions(_from date, _to date, _class_id uuid DEFAULT NULL)
RETURNS TABLE(class_id uuid, session_date date, start_time time, end_time time, status text, kind text, schedule_id uuid, exception_id uuid, rescheduled_to_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT cs.class_id, d::date AS session_date, cs.start_time, cs.end_time, cs.id AS schedule_id
    FROM public.class_schedules cs
    CROSS JOIN LATERAL generate_series(GREATEST(_from, cs.effective_from), LEAST(_to, COALESCE(cs.effective_to, _to)), interval '1 day') d
    WHERE extract(dow FROM d)::int = cs.day_of_week AND (_class_id IS NULL OR cs.class_id = _class_id)
  )
  SELECT b.class_id, b.session_date, b.start_time, b.end_time,
    CASE WHEN EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = b.session_date) THEN 'cancelled'
         WHEN e.type = 'cancelled' THEN 'cancelled'
         WHEN e.type = 'rescheduled' THEN 'rescheduled'
         ELSE 'scheduled' END,
    'regular', b.schedule_id, e.id, CASE WHEN e.type = 'rescheduled' THEN e.new_date END
  FROM base b
  LEFT JOIN LATERAL (SELECT * FROM public.schedule_exceptions x WHERE x.class_id = b.class_id AND x.date = b.session_date AND x.type IN ('cancelled','rescheduled') ORDER BY x.created_at LIMIT 1) e ON true
  UNION ALL
  SELECT e.class_id, COALESCE(e.new_date, e.date), COALESCE(e.new_start_time, c.start_time), COALESCE(e.new_end_time, c.end_time),
    'scheduled', CASE WHEN e.type = 'extra' THEN 'extra' ELSE 'rescheduled_to' END, NULL, e.id, NULL
  FROM public.schedule_exceptions e JOIN public.classes c ON c.id = e.class_id
  WHERE e.type IN ('rescheduled','extra') AND COALESCE(e.new_date, e.date) BETWEEN _from AND _to
    AND (_class_id IS NULL OR e.class_id = _class_id);
$$;

-- Regenerates stored sessions in a range. Sessions that already have attendance are never changed or removed.
-- Unless _include_past, dates before today are left untouched.
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
  ORDER BY x.class_id, x.session_date, x.start_time, (x.status = 'scheduled') DESC
  ON CONFLICT (class_id, session_date, start_time) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.extend_class_sessions() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.generate_class_sessions(NULL, CURRENT_DATE, CURRENT_DATE + 90, false);
$$;

CREATE OR REPLACE FUNCTION public.sessions_on_schedule_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; f date;
BEGIN
  IF TG_OP = 'DELETE' THEN cid := OLD.class_id; f := OLD.effective_from;
  ELSIF TG_OP = 'UPDATE' THEN cid := NEW.class_id; f := LEAST(OLD.effective_from, NEW.effective_from, COALESCE(OLD.effective_to, NEW.effective_from), COALESCE(NEW.effective_to, NEW.effective_from));
  ELSE cid := NEW.class_id; f := NEW.effective_from; END IF;
  PERFORM public.generate_class_sessions(cid, f, CURRENT_DATE + 90, false);
  RETURN NULL;
END $$;
CREATE TRIGGER sessions_on_schedule_change_trg AFTER INSERT OR UPDATE OR DELETE ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.sessions_on_schedule_change();

CREATE OR REPLACE FUNCTION public.sessions_on_exception_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES (OLD.class_id, OLD.date), (OLD.class_id, OLD.new_date), (NEW.class_id, NEW.date), (NEW.class_id, NEW.new_date)) v(cid, d)
           WHERE TG_OP <> 'INSERT' OR v.cid IS NOT DISTINCT FROM NEW.class_id LOOP
    IF r.cid IS NOT NULL AND r.d IS NOT NULL THEN PERFORM public.generate_class_sessions(r.cid, r.d, r.d, true); END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER sessions_on_exception_change_trg AFTER INSERT OR UPDATE OR DELETE ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.sessions_on_exception_change();

CREATE OR REPLACE FUNCTION public.sessions_on_holiday_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('DELETE','UPDATE') THEN PERFORM public.generate_class_sessions(NULL, OLD.date, OLD.date, true); END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM public.generate_class_sessions(NULL, NEW.date, NEW.date, true); END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER sessions_on_holiday_change_trg AFTER INSERT OR UPDATE OR DELETE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.sessions_on_holiday_change();

-- Authoritative read: stored sessions only.
CREATE OR REPLACE FUNCTION public.get_scheduled_sessions(_from date, _to date, _class_id uuid DEFAULT NULL)
RETURNS TABLE(class_id uuid, session_date date, start_time time, end_time time, kind text, is_frozen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (s.class_id, s.session_date) s.class_id, s.session_date, s.start_time, s.end_time,
    CASE s.kind WHEN 'rescheduled_to' THEN 'rescheduled' ELSE s.kind END, public.is_date_frozen(s.session_date)
  FROM public.class_sessions s
  WHERE s.status = 'scheduled' AND s.session_date BETWEEN _from AND _to AND (_class_id IS NULL OR s.class_id = _class_id)
  ORDER BY s.class_id, s.session_date, s.start_time;
$$;

CREATE OR REPLACE FUNCTION public.is_scheduled_session(_class_id uuid, _date date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_sessions WHERE class_id = _class_id AND session_date = _date AND status = 'scheduled');
$$;

-- The one Unmarked rule: session exists + person eligible (+ marked flag). Unmarked = rows where marked = false.
CREATE OR REPLACE FUNCTION public.get_session_attendance_status(_from date, _to date, _domain text, _class_id uuid DEFAULT NULL, _person_id uuid DEFAULT NULL)
RETURNS TABLE(class_id uuid, session_date date, person_id uuid, marked boolean, is_frozen boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE staff boolean := public.is_admin() OR public.is_co_admin();
  my_teacher uuid := public.get_teacher_id();
  my_student uuid := (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1);
BEGIN
  IF _domain = 'students' THEN
    RETURN QUERY
    SELECT s.class_id, s.session_date, st.id,
      EXISTS (SELECT 1 FROM public.attendance a WHERE a.student_id = st.id AND a.class_id = s.class_id AND a.date = s.session_date),
      public.is_date_frozen(s.session_date)
    FROM (SELECT DISTINCT cs.class_id, cs.session_date FROM public.class_sessions cs
          WHERE cs.status = 'scheduled' AND cs.session_date BETWEEN _from AND LEAST(_to, CURRENT_DATE)
            AND (_class_id IS NULL OR cs.class_id = _class_id)) s
    JOIN public.class_enrollments ce ON ce.class_id = s.class_id
    JOIN public.students st ON st.id = ce.student_id
    LEFT JOIN public.profiles p ON p.id = st.user_id
    WHERE st.enrollment_date <= s.session_date AND (st.exit_date IS NULL OR st.exit_date >= s.session_date)
      AND COALESCE(p.archived, false) = false
      AND (_person_id IS NULL OR st.id = _person_id)
      AND (staff OR st.id = my_student OR (my_teacher IS NOT NULL AND public.teacher_has_class(s.class_id)));
  ELSIF _domain = 'teachers' THEN
    RETURN QUERY
    SELECT s.class_id, s.session_date, t.id,
      EXISTS (SELECT 1 FROM public.teacher_attendance a WHERE a.teacher_id = t.id AND a.class_id = s.class_id AND a.date = s.session_date),
      public.is_date_frozen(s.session_date)
    FROM (SELECT DISTINCT cs.class_id, cs.session_date FROM public.class_sessions cs
          WHERE cs.status = 'scheduled' AND cs.session_date BETWEEN _from AND LEAST(_to, CURRENT_DATE)
            AND (_class_id IS NULL OR cs.class_id = _class_id)) s
    JOIN public.teacher_classes tc ON tc.class_id = s.class_id
    JOIN public.teachers t ON t.id = tc.teacher_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.joining_date <= s.session_date AND COALESCE(p.archived, false) = false
      AND (_person_id IS NULL OR t.id = _person_id)
      AND (staff OR t.id = my_teacher);
  ELSE
    RAISE EXCEPTION 'Unknown domain %', _domain;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_unmarked_attendance(_from date, _to date, _domain text, _class_id uuid DEFAULT NULL, _person_id uuid DEFAULT NULL)
RETURNS TABLE(class_id uuid, session_date date, person_id uuid, is_frozen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.class_id, x.session_date, x.person_id, x.is_frozen
  FROM public.get_session_attendance_status(_from, _to, _domain, _class_id, _person_id) x WHERE NOT x.marked;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_class_sessions(date, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_class_sessions(uuid, date, date, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extend_class_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sessions_on_schedule_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sessions_on_exception_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sessions_on_holiday_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.session_has_attendance(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_session_attendance_status(date, date, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unmarked_attendance(date, date, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_attendance_status(date, date, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unmarked_attendance(date, date, text, uuid, uuid) TO authenticated;

-- Backfill: sessions from each class's existing timetable start up to 90 days ahead. Attendance untouched.
SELECT public.generate_class_sessions(NULL, (SELECT COALESCE(MIN(effective_from), CURRENT_DATE) FROM public.class_schedules), CURRENT_DATE + 90, true);

SELECT cron.schedule('extend-class-sessions', '15 0 * * *', $$SELECT public.extend_class_sessions();$$);
