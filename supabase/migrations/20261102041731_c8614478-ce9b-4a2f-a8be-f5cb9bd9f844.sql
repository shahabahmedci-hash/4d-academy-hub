DROP FUNCTION IF EXISTS public.get_session_attendance_status(date, date, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_session_attendance_status(_from date, _to date, _domain text, _class_id uuid DEFAULT NULL::uuid, _person_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(class_id uuid, session_date date, person_id uuid, marked boolean, is_frozen boolean, status text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE staff boolean := public.is_admin() OR public.is_co_admin();
  my_teacher uuid := public.get_teacher_id();
  my_student uuid := (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1);
BEGIN
  IF _domain = 'students' THEN
    RETURN QUERY
    SELECT s.class_id, s.session_date, st.id,
      (a.status IS NOT NULL),
      public.is_date_frozen(s.session_date),
      a.status::text
    FROM (SELECT DISTINCT cs.class_id, cs.session_date FROM public.class_sessions cs
          WHERE cs.status = 'scheduled' AND cs.session_date BETWEEN _from AND LEAST(_to, CURRENT_DATE)
            AND (_class_id IS NULL OR cs.class_id = _class_id)) s
    JOIN public.class_enrollments ce ON ce.class_id = s.class_id
    JOIN public.students st ON st.id = ce.student_id
    LEFT JOIN public.profiles p ON p.id = st.user_id
    LEFT JOIN LATERAL (SELECT sa.status FROM public.attendance sa
                       WHERE sa.student_id = st.id AND sa.class_id = s.class_id AND sa.date = s.session_date LIMIT 1) a ON true
    WHERE st.enrollment_date <= s.session_date AND (st.exit_date IS NULL OR st.exit_date >= s.session_date)
      AND COALESCE(p.archived, false) = false
      AND (_person_id IS NULL OR st.id = _person_id)
      AND (staff OR st.id = my_student OR (my_teacher IS NOT NULL AND public.teacher_has_class(s.class_id)));
  ELSIF _domain = 'teachers' THEN
    RETURN QUERY
    SELECT s.class_id, s.session_date, t.id,
      (a.status IS NOT NULL),
      public.is_date_frozen(s.session_date),
      a.status::text
    FROM (SELECT DISTINCT cs.class_id, cs.session_date FROM public.class_sessions cs
          WHERE cs.status = 'scheduled' AND cs.session_date BETWEEN _from AND LEAST(_to, CURRENT_DATE)
            AND (_class_id IS NULL OR cs.class_id = _class_id)) s
    JOIN public.teacher_classes tc ON tc.class_id = s.class_id
    JOIN public.teachers t ON t.id = tc.teacher_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
    LEFT JOIN LATERAL (SELECT ta.status FROM public.teacher_attendance ta
                       WHERE ta.teacher_id = t.id AND ta.class_id = s.class_id AND ta.date = s.session_date LIMIT 1) a ON true
    WHERE t.joining_date <= s.session_date AND COALESCE(p.archived, false) = false
      AND (_person_id IS NULL OR t.id = _person_id)
      AND (staff OR t.id = my_teacher);
  ELSE
    RAISE EXCEPTION 'Unknown domain %', _domain;
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_session_attendance_status(date, date, text, uuid, uuid) TO authenticated;