CREATE POLICY "Teachers can view assigned class enrollments"
ON public.class_enrollments
FOR SELECT
TO authenticated
USING (public.teacher_has_class(class_id));

CREATE POLICY "Teachers can view assigned student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.user_id = profiles.id
      AND public.teacher_has_student(s.id)
  )
);