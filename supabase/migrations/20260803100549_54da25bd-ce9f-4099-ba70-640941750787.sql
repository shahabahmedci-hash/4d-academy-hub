
-- Students: self insert/update
CREATE POLICY "Students can create own record"
ON public.students FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can update own record"
ON public.students FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_student_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR public.is_co_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.student_id := NULL;
    NEW.class := NULL;
    NEW.section := NULL;
    NEW.stream := NULL;
  ELSE
    NEW.student_id := OLD.student_id;
    NEW.class := OLD.class;
    NEW.section := OLD.section;
    NEW.stream := OLD.stream;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_student_admin_fields_trg ON public.students;
CREATE TRIGGER protect_student_admin_fields_trg
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.protect_student_admin_fields();

-- Teachers: self insert/update
CREATE POLICY "Teachers can create own record"
ON public.teachers FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers can update own record"
ON public.teachers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_teacher_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR public.is_co_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.employee_id := NULL;
    NEW.designation := NULL;
    NEW.subjects := NULL;
  ELSE
    NEW.employee_id := OLD.employee_id;
    NEW.designation := OLD.designation;
    NEW.subjects := OLD.subjects;
    NEW.joining_date := OLD.joining_date;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_teacher_admin_fields_trg ON public.teachers;
CREATE TRIGGER protect_teacher_admin_fields_trg
BEFORE INSERT OR UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.protect_teacher_admin_fields();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.students TO service_role;
GRANT ALL ON public.teachers TO service_role;
