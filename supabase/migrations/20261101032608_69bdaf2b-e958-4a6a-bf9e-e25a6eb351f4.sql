
-- Students: also respect exit date. Existing rows are only re-checked if their student/class/date change.
CREATE OR REPLACE FUNCTION public.validate_student_attendance_date() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.student_id = OLD.student_id AND NEW.class_id = OLD.class_id AND NEW.date = OLD.date THEN RETURN NEW; END IF;
  SELECT s.enrollment_date, s.exit_date INTO st FROM public.students s WHERE s.id = NEW.student_id;
  IF st.enrollment_date IS NULL THEN RAISE EXCEPTION 'Student enrollment date is unavailable'; END IF;
  IF NEW.date < st.enrollment_date THEN RAISE EXCEPTION 'Attendance cannot be marked before the student enrollment date'; END IF;
  IF st.exit_date IS NOT NULL AND NEW.date > st.exit_date THEN RAISE EXCEPTION 'Attendance cannot be marked after the student exit date'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollments ce WHERE ce.student_id = NEW.student_id AND ce.class_id = NEW.class_id) THEN
    RAISE EXCEPTION 'Student is not enrolled in this class';
  END IF;
  RETURN NEW;
END $$;

-- Teachers: must be assigned to the class (matches the Unmarked rule).
CREATE OR REPLACE FUNCTION public.validate_teacher_attendance_date() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE jd date;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.teacher_id = OLD.teacher_id AND NEW.class_id = OLD.class_id AND NEW.date = OLD.date THEN RETURN NEW; END IF;
  SELECT t.joining_date INTO jd FROM public.teachers t WHERE t.id = NEW.teacher_id;
  IF jd IS NULL THEN RAISE EXCEPTION 'Teacher joining date is unavailable'; END IF;
  IF NEW.date < jd THEN RAISE EXCEPTION 'Attendance cannot be marked before the teacher joining date'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teacher_classes tc WHERE tc.teacher_id = NEW.teacher_id AND tc.class_id = NEW.class_id) THEN
    RAISE EXCEPTION 'Teacher is not assigned to this class';
  END IF;
  RETURN NEW;
END $$;
