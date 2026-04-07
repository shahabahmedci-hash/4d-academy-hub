
-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Anyone can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_co_admin());

-- User roles policies
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Students policies
CREATE POLICY "Admins can manage students" ON public.students FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Students can view own record" ON public.students FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Teachers can view their students" ON public.students FOR SELECT TO authenticated USING (public.teacher_has_student(id));

-- Teachers policies
CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Teachers can view own record" ON public.teachers FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Classes policies
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL TO authenticated USING (public.is_admin() OR public.is_co_admin());
CREATE POLICY "Authenticated can view classes" ON public.classes FOR SELECT TO authenticated USING (true);
