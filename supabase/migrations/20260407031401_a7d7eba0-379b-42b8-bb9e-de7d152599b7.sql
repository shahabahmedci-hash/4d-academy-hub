
-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_co_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'co_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND approved = true AND (archived IS NULL OR archived = false)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND approved = true AND (archived IS NULL OR archived = false)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_archived(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND archived = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_date_frozen(_date DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.financial_years
    WHERE is_frozen = true AND _date BETWEEN start_date AND end_date
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_class(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON tc.teacher_id = t.id
    WHERE tc.class_id = _class_id AND t.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_student(_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments ce
    JOIN public.teacher_classes tc ON ce.class_id = tc.class_id
    JOIN public.teachers t ON tc.teacher_id = t.id
    WHERE ce.student_id = _student_id AND t.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(total_students BIGINT, pending_fees BIGINT, todays_classes BIGINT, pending_approvals BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.students)::BIGINT,
    (SELECT count(*) FROM public.fees WHERE status = 'pending'::public.fee_status)::BIGINT,
    (SELECT count(*) FROM public.classes WHERE day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::BIGINT,
    (SELECT count(*) FROM public.profiles WHERE approved = false AND (archived IS NULL OR archived = false))::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_profile(_profile_id UUID, _archived_by UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET archived = true, archived_at = now(), archived_by = _archived_by, updated_at = now() WHERE id = _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_profile(_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET archived = false, archived_at = NULL, archived_by = NULL, updated_at = now() WHERE id = _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_student_id(first_name TEXT, last_name TEXT, enrollment_date TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  result := UPPER(LEFT(first_name, 2)) || UPPER(LEFT(last_name, 2)) || TO_CHAR(enrollment_date::DATE, 'YYMM') || LPAD((floor(random() * 999) + 1)::TEXT, 3, '0');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_employee_id(first_name TEXT, last_name TEXT, joining_date TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  result := 'EMP-' || UPPER(LEFT(first_name, 2)) || UPPER(LEFT(last_name, 2)) || TO_CHAR(joining_date::DATE, 'YYMM') || LPAD((floor(random() * 999) + 1)::TEXT, 3, '0');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_own_profile_protected_fields()
RETURNS TABLE(role public.user_role, approved BOOLEAN, approved_at TIMESTAMPTZ, approved_by UUID, archived BOOLEAN, archived_at TIMESTAMPTZ, archived_by UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role, p.approved, p.approved_at, p.approved_by, p.archived, p.archived_at, p.archived_by
  FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_own_student_protected_fields()
RETURNS TABLE(student_id TEXT, class TEXT, section TEXT, stream TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.student_id, s.class, s.section, s.stream
  FROM public.students s WHERE s.user_id = auth.uid();
$$;
