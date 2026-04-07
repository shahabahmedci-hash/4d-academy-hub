
-- Class enrollments
CREATE POLICY "Admins can manage enrollments" ON public.class_enrollments FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Students can view own enrollments" ON public.class_enrollments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = class_enrollments.student_id AND s.user_id = auth.uid())
);

-- Teacher classes
CREATE POLICY "Admins can manage teacher_classes" ON public.teacher_classes FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can view own classes" ON public.teacher_classes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_classes.teacher_id AND t.user_id = auth.uid())
);

-- Attendance
CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can manage class attendance" ON public.attendance FOR ALL TO authenticated USING (public.teacher_has_class(attendance.class_id));
CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid())
);

-- Teacher attendance
CREATE POLICY "Admins can manage teacher_attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can view own attendance" ON public.teacher_attendance FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_attendance.teacher_id AND t.user_id = auth.uid())
);

-- Fees
CREATE POLICY "Admins can manage fees" ON public.fees FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Students can view own fees" ON public.fees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = fees.student_id AND s.user_id = auth.uid())
);

-- Expenses
CREATE POLICY "Admins can manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());

-- Teacher salaries
CREATE POLICY "Admins can manage salaries" ON public.teacher_salaries FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can view own salary" ON public.teacher_salaries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_salaries.teacher_id AND t.user_id = auth.uid())
);

-- Documents
CREATE POLICY "Admins can manage documents" ON public.documents FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Authenticated can view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());

-- Assignments
CREATE POLICY "Admins can manage assignments" ON public.assignments FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can manage own assignments" ON public.assignments FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Authenticated can view assignments" ON public.assignments FOR SELECT TO authenticated USING (true);

-- Assignment submissions
CREATE POLICY "Admins can manage submissions" ON public.assignment_submissions FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Students can manage own submissions" ON public.assignment_submissions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
);

-- Financial years
CREATE POLICY "Admins can manage financial_years" ON public.financial_years FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Authenticated can view financial_years" ON public.financial_years FOR SELECT TO authenticated USING (true);

-- Automation settings
CREATE POLICY "Admins can manage automation_settings" ON public.automation_settings FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Authenticated can view automation_settings" ON public.automation_settings FOR SELECT TO authenticated USING (true);

-- Recurring templates
CREATE POLICY "Admins can manage recurring_templates" ON public.recurring_templates FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
