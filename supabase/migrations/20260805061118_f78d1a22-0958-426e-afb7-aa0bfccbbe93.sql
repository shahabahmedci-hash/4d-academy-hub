CREATE OR REPLACE FUNCTION public.assign_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name_value text;
  first_name_value text;
  last_name_value text;
  candidate text;
BEGIN
  IF NEW.student_id IS NOT NULL AND btrim(NEW.student_id) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT btrim(p.full_name) INTO full_name_value
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  first_name_value := COALESCE(NULLIF(split_part(full_name_value, ' ', 1), ''), 'ST');
  last_name_value := COALESCE(NULLIF(regexp_replace(full_name_value, '^.*\s+', ''), ''), first_name_value);

  LOOP
    candidate := upper(left(first_name_value, 2))
      || upper(left(last_name_value, 2))
      || to_char(COALESCE(NEW.enrollment_date, CURRENT_DATE), 'YYMM')
      || lpad((floor(random() * 999) + 1)::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students s WHERE s.student_id = candidate AND s.id IS DISTINCT FROM NEW.id
    );
  END LOOP;

  NEW.student_id := candidate;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_name_value text;
  first_name_value text;
  last_name_value text;
  candidate text;
BEGIN
  IF NEW.employee_id IS NOT NULL AND btrim(NEW.employee_id) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT btrim(p.full_name) INTO full_name_value
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  first_name_value := COALESCE(NULLIF(split_part(full_name_value, ' ', 1), ''), 'EM');
  last_name_value := COALESCE(NULLIF(regexp_replace(full_name_value, '^.*\s+', ''), ''), first_name_value);

  LOOP
    candidate := 'EMP-'
      || upper(left(first_name_value, 2))
      || upper(left(last_name_value, 2))
      || to_char(COALESCE(NEW.joining_date, CURRENT_DATE), 'YYMM')
      || lpad((floor(random() * 999) + 1)::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teachers t WHERE t.employee_id = candidate AND t.id IS DISTINCT FROM NEW.id
    );
  END LOOP;

  NEW.employee_id := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_assign_student_id_trg ON public.students;
CREATE TRIGGER z_assign_student_id_trg
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.assign_student_id();

DROP TRIGGER IF EXISTS z_assign_employee_id_trg ON public.teachers;
CREATE TRIGGER z_assign_employee_id_trg
BEFORE INSERT OR UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.assign_employee_id();

CREATE UNIQUE INDEX IF NOT EXISTS students_student_id_unique_idx
ON public.students (student_id)
WHERE student_id IS NOT NULL AND btrim(student_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS teachers_employee_id_unique_idx
ON public.teachers (employee_id)
WHERE employee_id IS NOT NULL AND btrim(employee_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_class_student_unique_idx
ON public.class_enrollments (class_id, student_id);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_unique_idx
ON public.attendance (student_id, class_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_attendance_teacher_class_date_unique_idx
ON public.teacher_attendance (teacher_id, class_id, date);

CREATE OR REPLACE FUNCTION public.sync_student_class_enrollments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.class IS NULL OR btrim(NEW.class) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.class IS DISTINCT FROM NEW.class OR OLD.section IS DISTINCT FROM NEW.section
  ) THEN
    DELETE FROM public.class_enrollments ce
    WHERE ce.student_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = ce.class_id
          AND lower(btrim(c.class)) = lower(btrim(NEW.class))
          AND (
            (NEW.section IS NULL AND c.section IS NULL)
            OR lower(btrim(c.section)) = lower(btrim(NEW.section))
          )
      );
  END IF;

  INSERT INTO public.class_enrollments (class_id, student_id, enrolled_at)
  SELECT c.id, NEW.id, COALESCE(NEW.enrollment_date, CURRENT_DATE)::timestamp AT TIME ZONE 'UTC'
  FROM public.classes c
  WHERE lower(btrim(c.class)) = lower(btrim(NEW.class))
    AND (
      (NEW.section IS NULL AND c.section IS NULL)
      OR lower(btrim(c.section)) = lower(btrim(NEW.section))
    )
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET enrolled_at = EXCLUDED.enrolled_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_student_class_enrollments_trg ON public.students;
CREATE TRIGGER sync_student_class_enrollments_trg
AFTER INSERT OR UPDATE OF class, section, enrollment_date ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_student_class_enrollments();

CREATE OR REPLACE FUNCTION public.validate_student_attendance_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  student_enrollment_date date;
BEGIN
  SELECT s.enrollment_date INTO student_enrollment_date
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF student_enrollment_date IS NULL THEN
    RAISE EXCEPTION 'Student enrollment date is unavailable';
  END IF;

  IF NEW.date < student_enrollment_date THEN
    RAISE EXCEPTION 'Attendance cannot be marked before the student enrollment date';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_enrollments ce
    WHERE ce.student_id = NEW.student_id AND ce.class_id = NEW.class_id
  ) THEN
    RAISE EXCEPTION 'Student is not enrolled in this class';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_attendance_date_trg ON public.attendance;
CREATE TRIGGER validate_student_attendance_date_trg
BEFORE INSERT OR UPDATE OF student_id, class_id, date ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.validate_student_attendance_date();

CREATE OR REPLACE FUNCTION public.validate_teacher_attendance_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  teacher_joining_date date;
BEGIN
  SELECT t.joining_date INTO teacher_joining_date
  FROM public.teachers t
  WHERE t.id = NEW.teacher_id;

  IF teacher_joining_date IS NULL THEN
    RAISE EXCEPTION 'Teacher joining date is unavailable';
  END IF;

  IF NEW.date < teacher_joining_date THEN
    RAISE EXCEPTION 'Attendance cannot be marked before the teacher joining date';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_teacher_attendance_date_trg ON public.teacher_attendance;
CREATE TRIGGER validate_teacher_attendance_date_trg
BEFORE INSERT OR UPDATE OF teacher_id, date ON public.teacher_attendance
FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_attendance_date();