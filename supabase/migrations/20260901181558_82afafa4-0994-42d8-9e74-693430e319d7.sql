CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_attendance_updated_at ON public.teacher_attendance;
CREATE TRIGGER update_teacher_attendance_updated_at BEFORE UPDATE ON public.teacher_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.teacher_attendance ALTER COLUMN class_id SET NOT NULL;

ALTER TABLE public.teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_status_check;
ALTER TABLE public.teacher_attendance
  ADD CONSTRAINT teacher_attendance_status_check CHECK (status IN ('present','absent'));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS exit_date date;

CREATE OR REPLACE FUNCTION public.enforce_attendance_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_date := OLD.date;
  ELSE
    target_date := NEW.date;
  END IF;

  IF auth.uid() IS NULL OR public.is_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF public.is_date_frozen(target_date) THEN
    RAISE EXCEPTION 'Attendance for % falls in a frozen financial year and cannot be modified', target_date;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS enforce_attendance_freeze_trg ON public.attendance;
CREATE TRIGGER enforce_attendance_freeze_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_freeze();

DROP TRIGGER IF EXISTS enforce_attendance_freeze_trg ON public.teacher_attendance;
CREATE TRIGGER enforce_attendance_freeze_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.teacher_attendance
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_freeze();

CREATE INDEX IF NOT EXISTS attendance_class_date_idx ON public.attendance (class_id, date);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON public.attendance (student_id, date);
CREATE INDEX IF NOT EXISTS teacher_attendance_class_date_idx ON public.teacher_attendance (class_id, date);
CREATE INDEX IF NOT EXISTS teacher_attendance_teacher_date_idx ON public.teacher_attendance (teacher_id, date);

DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can manage class attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;

CREATE POLICY "Admins view attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins insert attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_co_admin())
  WITH CHECK (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins delete attendance" ON public.attendance FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_co_admin());

CREATE POLICY "Teachers view assigned class attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.teacher_has_class(class_id));
CREATE POLICY "Teachers insert assigned class attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.teacher_has_class(class_id) AND public.teacher_has_student(student_id));
CREATE POLICY "Teachers update assigned class attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.teacher_has_class(class_id))
  WITH CHECK (public.teacher_has_class(class_id) AND public.teacher_has_student(student_id));
CREATE POLICY "Teachers delete assigned class attendance" ON public.attendance FOR DELETE TO authenticated
  USING (public.teacher_has_class(class_id));

CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage teacher_attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers can view own attendance" ON public.teacher_attendance;

CREATE POLICY "Admins view teacher_attendance" ON public.teacher_attendance FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins insert teacher_attendance" ON public.teacher_attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins update teacher_attendance" ON public.teacher_attendance FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_co_admin())
  WITH CHECK (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Admins delete teacher_attendance" ON public.teacher_attendance FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_co_admin());

CREATE POLICY "Teachers view own teacher_attendance" ON public.teacher_attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_attendance.teacher_id AND t.user_id = auth.uid()));