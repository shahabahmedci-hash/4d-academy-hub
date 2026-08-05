CREATE OR REPLACE FUNCTION public.sync_class_student_enrollments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.class IS NULL OR btrim(NEW.class) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.class_enrollments (class_id, student_id, enrolled_at)
  SELECT NEW.id, s.id, s.enrollment_date::timestamp AT TIME ZONE 'UTC'
  FROM public.students s
  WHERE lower(btrim(s.class)) = lower(btrim(NEW.class))
    AND (
      (NEW.section IS NULL AND s.section IS NULL)
      OR lower(btrim(s.section)) = lower(btrim(NEW.section))
    )
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET enrolled_at = EXCLUDED.enrolled_at;

  IF TG_OP = 'UPDATE' AND (
    OLD.class IS DISTINCT FROM NEW.class OR OLD.section IS DISTINCT FROM NEW.section
  ) THEN
    DELETE FROM public.class_enrollments ce
    WHERE ce.class_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id = ce.student_id
          AND lower(btrim(s.class)) = lower(btrim(NEW.class))
          AND (
            (NEW.section IS NULL AND s.section IS NULL)
            OR lower(btrim(s.section)) = lower(btrim(NEW.section))
          )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_class_student_enrollments_trg ON public.classes;
CREATE TRIGGER sync_class_student_enrollments_trg
AFTER INSERT OR UPDATE OF class, section ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.sync_class_student_enrollments();