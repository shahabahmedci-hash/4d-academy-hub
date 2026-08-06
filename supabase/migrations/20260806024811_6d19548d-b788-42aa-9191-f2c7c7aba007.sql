CREATE OR REPLACE FUNCTION public.protect_student_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_co_admin() THEN
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

CREATE OR REPLACE FUNCTION public.protect_teacher_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_co_admin() THEN
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