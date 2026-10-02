CREATE TABLE public.class_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedules TO authenticated;
GRANT ALL ON public.class_schedules TO service_role;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view schedules" ON public.class_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage schedules" ON public.class_schedules FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin()) WITH CHECK (public.is_admin() OR public.is_co_admin());
CREATE INDEX idx_class_schedules_class ON public.class_schedules(class_id, effective_from);
CREATE TRIGGER update_class_schedules_updated_at BEFORE UPDATE ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL,
  new_date date,
  new_start_time time,
  new_end_time time,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, date, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_exceptions TO authenticated;
GRANT ALL ON public.schedule_exceptions TO service_role;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view exceptions" ON public.schedule_exceptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exceptions" ON public.schedule_exceptions FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin()) WITH CHECK (public.is_admin() OR public.is_co_admin());

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  label text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin()) WITH CHECK (public.is_admin() OR public.is_co_admin());

-- Validation
CREATE OR REPLACE FUNCTION public.validate_class_schedule() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.day_of_week < 0 OR NEW.day_of_week > 6 THEN RAISE EXCEPTION 'Invalid weekday'; END IF;
  IF NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;
  IF NEW.effective_to IS NOT NULL AND NEW.effective_to < NEW.effective_from THEN RAISE EXCEPTION 'Schedule end date is before its start date'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_class_schedule_trg BEFORE INSERT OR UPDATE ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.validate_class_schedule();

CREATE OR REPLACE FUNCTION public.validate_schedule_exception() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type NOT IN ('cancelled','rescheduled','extra') THEN RAISE EXCEPTION 'Invalid exception type'; END IF;
  IF NEW.type = 'rescheduled' AND NEW.new_date IS NULL THEN RAISE EXCEPTION 'A rescheduled session needs a new date'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_schedule_exception_trg BEFORE INSERT OR UPDATE ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_exception();

-- Single source of truth for sessions
CREATE OR REPLACE FUNCTION public.get_scheduled_sessions(_from date, _to date, _class_id uuid DEFAULT NULL)
RETURNS TABLE(class_id uuid, session_date date, start_time time, end_time time, kind text, is_frozen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT cs.class_id, d::date AS session_date, cs.start_time, cs.end_time, 'regular'::text AS kind
    FROM public.class_schedules cs
    CROSS JOIN LATERAL generate_series(GREATEST(_from, cs.effective_from), LEAST(_to, COALESCE(cs.effective_to, _to)), interval '1 day') d
    WHERE extract(dow FROM d)::int = cs.day_of_week
      AND (_class_id IS NULL OR cs.class_id = _class_id)
  ), regular AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = b.session_date)
      AND NOT EXISTS (SELECT 1 FROM public.schedule_exceptions e WHERE e.class_id = b.class_id AND e.date = b.session_date AND e.type IN ('cancelled','rescheduled'))
  ), moved AS (
    SELECT e.class_id, COALESCE(e.new_date, e.date) AS session_date,
      COALESCE(e.new_start_time, c.start_time) AS start_time, COALESCE(e.new_end_time, c.end_time) AS end_time,
      e.type AS kind
    FROM public.schedule_exceptions e JOIN public.classes c ON c.id = e.class_id
    WHERE e.type IN ('rescheduled','extra')
      AND COALESCE(e.new_date, e.date) BETWEEN _from AND _to
      AND (_class_id IS NULL OR e.class_id = _class_id)
  )
  SELECT DISTINCT ON (x.class_id, x.session_date) x.class_id, x.session_date, x.start_time, x.end_time, x.kind, public.is_date_frozen(x.session_date)
  FROM (SELECT * FROM regular UNION ALL SELECT * FROM moved) x
  ORDER BY x.class_id, x.session_date, x.kind;
$$;

CREATE OR REPLACE FUNCTION public.is_scheduled_session(_class_id uuid, _date date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.get_scheduled_sessions(_date, _date, _class_id));
$$;

-- Attendance must fall on a real session (main admin may override)
CREATE OR REPLACE FUNCTION public.validate_attendance_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.date = OLD.date AND NEW.class_id = OLD.class_id THEN RETURN NEW; END IF;
  IF NOT public.is_scheduled_session(NEW.class_id, NEW.date) THEN
    RAISE EXCEPTION 'No scheduled class session on % for this class', NEW.date;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_attendance_session_trg BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_session();
CREATE TRIGGER validate_attendance_session_trg BEFORE INSERT OR UPDATE ON public.teacher_attendance FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_session();

-- Protect historical periods that already have attendance
CREATE OR REPLACE FUNCTION public.class_has_attendance_between(_class_id uuid, _from date, _to date, _dow int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.attendance a WHERE a.class_id = _class_id AND a.date BETWEEN _from AND COALESCE(_to, '9999-12-31'::date) AND extract(dow FROM a.date)::int = _dow)
      OR EXISTS (SELECT 1 FROM public.teacher_attendance a WHERE a.class_id = _class_id AND a.date BETWEEN _from AND COALESCE(_to, '9999-12-31'::date) AND extract(dow FROM a.date)::int = _dow);
$$;

CREATE OR REPLACE FUNCTION public.protect_schedule_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.class_has_attendance_between(OLD.class_id, OLD.effective_from, OLD.effective_to, OLD.day_of_week) THEN
      RAISE EXCEPTION 'This schedule period already has attendance and cannot be removed';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.day_of_week <> OLD.day_of_week OR NEW.start_time <> OLD.start_time OR NEW.end_time <> OLD.end_time OR NEW.class_id <> OLD.class_id THEN
    IF public.class_has_attendance_between(OLD.class_id, OLD.effective_from, OLD.effective_to, OLD.day_of_week) THEN
      RAISE EXCEPTION 'This schedule period already has attendance; start a new schedule from a date instead';
    END IF;
  END IF;
  IF NEW.effective_from > OLD.effective_from AND public.class_has_attendance_between(OLD.class_id, OLD.effective_from, NEW.effective_from - 1, OLD.day_of_week) THEN
    RAISE EXCEPTION 'Attendance exists before the new start date of this schedule';
  END IF;
  IF NEW.effective_to IS NOT NULL AND (OLD.effective_to IS NULL OR NEW.effective_to < OLD.effective_to)
     AND public.class_has_attendance_between(OLD.class_id, NEW.effective_to + 1, OLD.effective_to, OLD.day_of_week) THEN
    RAISE EXCEPTION 'Attendance exists after % under this schedule; choose a later change date', NEW.effective_to;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_schedule_history_trg BEFORE UPDATE OR DELETE ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.protect_schedule_history();

-- Change schedule from a date: closes current periods, adds new slots, mirrors onto classes
CREATE OR REPLACE FUNCTION public.change_class_schedule(_class_id uuid, _effective_from date, _slots jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; first_slot jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_co_admin()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF jsonb_array_length(_slots) = 0 THEN RAISE EXCEPTION 'At least one weekly slot is required'; END IF;
  DELETE FROM public.class_schedules WHERE class_id = _class_id AND effective_from >= _effective_from;
  UPDATE public.class_schedules SET effective_to = _effective_from - 1
   WHERE class_id = _class_id AND effective_from < _effective_from AND (effective_to IS NULL OR effective_to >= _effective_from);
  FOR s IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time, effective_from, created_by)
    VALUES (_class_id, (s->>'day_of_week')::int, (s->>'start_time')::time, (s->>'end_time')::time, _effective_from, auth.uid());
  END LOOP;
  first_slot := _slots->0;
  IF _effective_from <= CURRENT_DATE THEN
    PERFORM set_config('app.schedule_sync', 'on', true);
    UPDATE public.classes SET day_of_week = (first_slot->>'day_of_week')::int,
      start_time = (first_slot->>'start_time')::time, end_time = (first_slot->>'end_time')::time
    WHERE id = _class_id;
    PERFORM set_config('app.schedule_sync', 'off', true);
  END IF;
END $$;

-- Keep legacy class inserts/edits safe
CREATE OR REPLACE FUNCTION public.sync_class_schedule_from_class() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time, effective_from, created_by)
    VALUES (NEW.id, NEW.day_of_week, NEW.start_time, NEW.end_time, COALESCE(NEW.created_at::date, CURRENT_DATE), auth.uid());
    RETURN NEW;
  END IF;
  IF current_setting('app.schedule_sync', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.day_of_week IS DISTINCT FROM OLD.day_of_week OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    DELETE FROM public.class_schedules WHERE class_id = NEW.id AND effective_from >= CURRENT_DATE;
    UPDATE public.class_schedules SET effective_to = CURRENT_DATE - 1
      WHERE class_id = NEW.id AND effective_from < CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);
    INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time, effective_from, created_by)
    VALUES (NEW.id, NEW.day_of_week, NEW.start_time, NEW.end_time, CURRENT_DATE, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_class_schedule_trg AFTER INSERT OR UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.sync_class_schedule_from_class();

-- Admin review list of records outside any scheduled session
CREATE OR REPLACE FUNCTION public.get_off_schedule_attendance()
RETURNS TABLE(domain text, record_id uuid, class_id uuid, date date, person_id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'students', a.id, a.class_id, a.date, a.student_id, a.status::text FROM public.attendance a
   WHERE (public.is_admin() OR public.is_co_admin()) AND NOT public.is_scheduled_session(a.class_id, a.date)
  UNION ALL
  SELECT 'teachers', a.id, a.class_id, a.date, a.teacher_id, a.status FROM public.teacher_attendance a
   WHERE (public.is_admin() OR public.is_co_admin()) AND NOT public.is_scheduled_session(a.class_id, a.date)
  ORDER BY 4 DESC;
$$;

-- Seed one period per existing class (no attendance touched)
INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time, effective_from)
SELECT c.id, c.day_of_week, c.start_time, c.end_time,
  LEAST(c.created_at::date,
        COALESCE((SELECT min(date) FROM public.attendance a WHERE a.class_id = c.id), c.created_at::date),
        COALESCE((SELECT min(date) FROM public.teacher_attendance t WHERE t.class_id = c.id), c.created_at::date))
FROM public.classes c
WHERE NOT EXISTS (SELECT 1 FROM public.class_schedules s WHERE s.class_id = c.id);