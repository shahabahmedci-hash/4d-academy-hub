
# Parity Audit & Fix Plan — vs `shahabahmedci-hash/d-academy-connect`

Three parallel audits compared every page/component against the reference. Below is the consolidated diff and a phased fix plan. Pages not listed are byte-equivalent or local-only enhancements (kept).

---

## Findings by portal

### Admin (18 pages)
- **FinancialYears** — no auth gate (anyone can freeze/unfreeze); no confirm dialog; manual date entry instead of "Start Year" auto-builder; missing `frozen_at` display.
- **ArchivedProfiles** — missing permanent-delete (cascade), search, year filter, Table layout, joined student/archiver data.
- **Documents** — upload has no class/section/stream targeting → student-side filtering is broken; no accepted-type filter; flat file input.
- **TeacherDetails** — missing "Edit Profile" and "View Attendance" action buttons.
- **AdminDashboard** — wrong icon (`DollarSign` → `IndianRupee`); wrong logo (`logo.png` → `4d-academy-logo.jpg`); FY quick-action shown to co-admins; AIInsightsPanel doesn't belong here.
- **CoAdmins** — missing search, phone/address, Edit Profile navigation.
- **Approvals** — unauthorized redirect goes to `/` instead of `/student/dashboard`.

### Student (6 pages)
- **StudentDashboard** — no approval gate; no profile-incomplete banner; nav tiles not disabled when incomplete; missing logo/Quick-Actions card; `DollarSign` → `IndianRupee`.
- **StudentProfile** — no one-time lock after `profile_completed=true`; `address` stored on `profiles` instead of `students`; no Locked alert; Save always visible.
- **StudentSchedule** — queries `class_enrollments` (misses admin-assigned class/section students); should filter `classes` by `student.class` + `section`; tab UI vs ref's grouped day-section scroll.
- **StudentAttendance** — missing subject filter, summary stats strip, class/batch badge; `AttendanceRecordsList` not extracted as component.
- **StudentFees** — no receipt download (`generateReceipt` + `/preview-download`); missing Total stat; amounts not `.toFixed(2)`; no Payment Records header.
- **StudentDocuments** — no file-type badges, no class/section/stream chips, no upload date; missing student-record guard; signed URL TTL 300s vs ref 3600s.

### Teacher (8 pages) + missing component
- **TeacherDocuments** — entire upload flow absent (dialog, file input, Supabase Storage upload, type filter). Major gap.
- **TeacherSalary** — `generateSalaryReceipt` + Download button absent; no Total Paid/Pending; no status badge / payment_method / notes.
- **TeacherClasses** — `ClassDetailsDialog` not used and **does not exist in project**; no day-grouping; no profile-completion redirect.
- **TeacherDashboard** — no logout AlertDialog; no profile-completion redirect; missing Today's Classes / Pending Salary stats; missing header (logo, NotificationBell, ThemeToggle); no `is_teacher` guard.
- **TeacherProfile** — `AvatarUpload` not integrated; emergency contact + subjects fields not rendered.
- **TeacherStudents** — `ProfileAvatar` not rendered; missing student_id/section/class chips.
- **TeacherAttendanceMark / TeacherMyAttendance** — filename divergence from ref (`TeacherAttendance.tsx` / `TeacherAttendanceView.tsx`); needs reconciliation but core logic present.

### Shared
- **Index.tsx** — no landing page; `/` jumps straight to Auth. Ref has Navbar/Hero/About/Courses/Features/Contact/Footer/AdBanner.
- **Auth.tsx / ResetPassword.tsx** — no `zod` validation; no inline field errors; missing logo + ThemeToggle; no password-requirements hint.
- **BottomNav** — `DollarSign` used app-wide instead of `IndianRupee`.
- **Notifications** — no pagination ("Load More"); back route not role-aware.

---

## Phased fix plan

Work delivered in batches; each phase ends in a usable, testable state. Backend (RLS, dispatcher, types) is **not** touched unless flagged. No new migrations required — every fix targets existing tables/columns.

### Phase 1 — P0 correctness & security (1 batch)
1. **FinancialYears** auth gate (`is_admin` only) + confirm dialog + "Start Year" auto-builder + `frozen_at` display.
2. **Admin Documents** upload: add class/section/stream selects, type-filter, `useRef` file input. Load options from `students` table.
3. **Student Dashboard** approval gate (`approved` + `is_admin`/`is_co_admin` redirects) + profile-incomplete banner + disable tiles when incomplete.
4. **Student Profile** one-time lock (set `profile_completed=true`, disable inputs when locked, hide Save, Locked alert). Move `address` to `students` table; require it.
5. **Student Schedule** query fix: filter `classes` by `student.class` + `section` (keep enrollments as secondary).

### Phase 2 — P0 missing features (1 batch)
6. **Teacher Documents** full upload flow (dialog + form + Supabase Storage + type filter + list w/ badges).
7. **Teacher Salary** receipt download via `generateSalaryReceipt`; Total Paid/Pending; status badge; payment_method/notes display.
8. **Create `ClassDetailsDialog`** component + wire into TeacherClasses (Eye button, MapPin/Clock icons, day grouping).
9. **Student Fees** receipt download (`generateReceipt` → `/preview-download`); Total stat card; `.toFixed(2)`; Payment Records header.
10. **TeacherDetails** add Edit Profile + View Attendance buttons.

### Phase 3 — P1 UX & validation (1 batch)
11. **Auth + ResetPassword** add `zod` schemas (login/signup/reset/newPassword), inline errors, password-requirements hint, logo + ThemeToggle.
12. **TeacherDashboard** logout AlertDialog, profile-completion redirect, Today's Classes + Pending Salary stats, header (logo/NotificationBell/ThemeToggle), `is_teacher` guard.
13. **TeacherProfile** integrate `AvatarUpload`; render emergency contact + subjects.
14. **TeacherStudents** render `ProfileAvatar` + student_id/section/class chips.
15. **ArchivedProfiles** rebuild as Table with search, year filter, joined student/archiver data, permanent-delete AlertDialog (cascade: students → teachers → user_roles → notifications → profiles).
16. **CoAdmins** add search, phone/address, Edit Profile button (keep local Revoke as additional action).

### Phase 4 — P1/P2 polish (1 batch)
17. **BottomNav + AdminDashboard + StudentDashboard + StudentFees** swap `DollarSign` → `IndianRupee` app-wide.
18. **AdminDashboard** logo asset swap, gate Financial Years quick-action to `isAdminUser`, remove `AIInsightsPanel` (keep on Analytics).
19. **Student Attendance** subject filter dropdown, summary stats strip, class/batch badge; extract `AttendanceRecordsList` component.
20. **Student Documents** file-type badges, class/section/stream chips, upload date, student guard, signed URL TTL → 3600s.
21. **Notifications** pagination (Load More, PAGE_SIZE=20) + role-aware back navigation.
22. **Approvals** redirect unauthorized to `/student/dashboard`.

### Phase 5 — Landing page (optional, last)
23. **Index.tsx** marketing landing (Navbar/Hero/About/Courses/Features/Contact/Footer/AdBanner). Only if you want public-facing marketing; otherwise keep auth-first.

---

## Out of scope
- DB migrations (none needed for any phase).
- Edge functions (`automation-dispatcher`, etc.) — already at parity.
- Reference renames (`TeacherAttendance` ↔ `TeacherAttendanceMark`): keep current names; ours are clearer.
- Any local enhancements already richer than ref (Students filter, Expenses charts, StudentDetails badge) — **kept**.

---

## How to proceed
Approve the plan and I'll execute **Phase 1** first, then ping you for verification before moving to Phase 2. Or tell me to run multiple phases back-to-back, or to reorder priorities.
