# Attendance Module — Phase 1 Audit & Implementation Plan

## 1. Current architecture (verified against the live database and code)

Two authoritative tables already exist — no duplicates found:

- `public.attendance` — student attendance: `student_id`, `class_id`, `date`, `status` (enum `attendance_status`: present, absent), `notes`, `marked_by`, `created_at`. Unique index on `(student_id, class_id, date)`.
- `public.teacher_attendance` — teacher attendance: `teacher_id`, `class_id` (nullable), `date`, `status` (**plain text, unconstrained**), `notes`, `marked_by`, `created_at`. Unique index on `(teacher_id, class_id, date)`.

Neither table has `updated_at`.

"Batch" in this project is **not a table** — it is the `section` text field on `classes` and `students`. A class row already carries `class` + `section`, so `class_id` fully determines the batch. Triggers `sync_student_class_enrollments` / `sync_class_student_enrollments` keep `class_enrollments` in sync by matching class+section.

Current data: 4 student rows, 3 teacher rows, all dated 2026-08-04, all with a non-null `class_id`.

RLS today:
- `attendance`: admin/co-admin ALL; teachers ALL where `teacher_has_class(class_id)`; students SELECT own.
- `teacher_attendance`: admin/co-admin ALL; teachers SELECT own only. Students have no policy (correctly blocked).

Attendance-touching UI: admin `Attendance.tsx`, admin `TeacherAttendance.tsx`, teacher `TeacherAttendanceMark.tsx`, teacher `TeacherMyAttendance.tsx`, student `StudentAttendance.tsx`, both dashboards, `Analytics.tsx`, `StudentDetails`/`TeacherDetails`, two import dialogs, four chart components.

## 2. Base project (d-academy-connect) vs current

The target has already moved ahead of the base in exactly the areas you flagged: class-aware teacher attendance (base keyed teacher+date), financial-year freeze, centralized role helpers, enrollment-date eligibility, auto ID generation. These stay. The base contributes nothing the target is missing in the attendance domain; no code will be copied back.

## 3. Problems found

1. **Date pickers are dropdowns, not calendars.** Both admin attendance pages build a synthetic list of weekly dates from `day_of_week` and render a `Select`. The teacher's own marking page does use a real calendar.
2. **Status mismatch.** `StudentAttendance.tsx` shows Late and Excused filter chips, but the enum only stores present/absent — those chips can never match a record.
3. **`teacher_attendance.status` is free text** with no check constraint, so any string can be written (imports included).
4. **Frozen periods are frontend-only.** `is_date_frozen()` exists but no trigger uses it; a direct API call can write into a frozen year.
5. **Nullable `class_id` on teacher attendance** lets NULL rows bypass the unique index and creates unattributed records.
6. **No `updated_at`** on either table, so corrections are untraceable.
7. **No eligibility beyond enrollment date.** Archived students still appear in marking lists; there is no exit/withdrawal date column at all.
8. **Filtering is thin.** No teacher→class→batch→date dependent filters, no status filter, no date-range/month navigation on the admin screens.
9. **No supporting indexes** for `(class_id, date)` / `(teacher_id, date)` lookups.
10. **No confirmation on bulk save** — teacher marking silently defaults everyone to Present and overwrites on save.

## 4. Proposed database changes (one migration, additive and non-destructive)

- Add `updated_at timestamptz not null default now()` + update trigger to both tables.
- Backfill any NULL `class_id` teacher rows: none exist today, so make `class_id` `NOT NULL` safely (verified before applying; if rows appear, they are reported and left alone instead).
- Constrain `teacher_attendance.status` to the same vocabulary as student attendance.
- Decide statuses once: keep **present / absent** only (matches all stored data), and remove Late/Excused from the UI. Extending the enum instead is possible on request.
- Add a `BEFORE INSERT/UPDATE/DELETE` trigger on both tables rejecting any row whose `date` falls in a frozen financial year, unless the caller is an admin (explicit override), enforced server-side.
- Add `status` to student eligibility: add `exit_date date` (nullable) to `students` so withdrawal can be respected; existing rows unaffected.
- Add indexes: `attendance(class_id, date)`, `attendance(student_id, date)`, `teacher_attendance(class_id, date)`, `teacher_attendance(teacher_id, date)`.
- **No `batch_id` column** — batch is already determined by `class_id`; adding it would denormalize and risk divergence.

## 5. Proposed RLS changes

- Keep the existing model, tighten the write paths: replace the broad `FOR ALL` policies with explicit SELECT/INSERT/UPDATE/DELETE policies carrying `WITH CHECK` clauses (currently missing), so a teacher cannot insert a row for a class they do not own.
- Explicitly deny teachers any write on `teacher_attendance` (self-marking stays off).
- Confirm students remain SELECT-own-only on `attendance` and fully blocked on `teacher_attendance`.
- Verify each rule with real queries as a signed-in student and teacher after the migration.

## 6. Proposed UI changes

- **Admin/Co-admin student attendance**: calendar date picker, dependent Class → Batch filters, status filter, present/absent/total counters, confirmed "Mark all Present", frozen-period banner, archived/exited students excluded at query level.
- **Admin/Co-admin teacher attendance**: marking flow becomes Teacher → Class → Batch → Date with a calendar; changing teacher refreshes only that teacher's classes; loads and updates the existing record; adds date-range/month filtering to history.
- **Teacher marking page**: batch label, totals row, explicit save confirmation, frozen indicator.
- **Teacher My Attendance / Student Attendance**: single filtered dataset feeding list, pie chart, monthly breakdown and percentage; remove unstorable statuses; add class/batch/date filters.
- **Dashboards**: attendance percentage derived from the same query shape as the detail pages.
- All screens reuse existing shadcn components, badges, skeletons, empty/error states; responsive layouts kept.

## 7. Data migration risks

- Low: only 7 attendance rows exist, all with class_id set, all present/absent. No deletion, no rewriting of existing records.
- The freeze trigger could block a legitimate historical correction — mitigated by the admin override path.
- Making `class_id` NOT NULL is checked against live data first and skipped with a report if any NULL appears.

## 8. Files that will be modified

Database: one new migration (plus a follow-up if RLS verification reveals gaps).

Frontend:
`src/pages/admin/Attendance.tsx`, `src/pages/admin/TeacherAttendance.tsx`, `src/pages/teacher/TeacherAttendanceMark.tsx`, `src/pages/teacher/TeacherMyAttendance.tsx`, `src/pages/student/StudentAttendance.tsx`, `src/pages/student/StudentDashboard.tsx`, `src/pages/teacher/TeacherDashboard.tsx`, `src/components/student/AttendancePieChart.tsx`, `src/components/student/AttendanceMonthlyBreakdown.tsx`, `src/components/teacher/TeacherAttendancePieChart.tsx`, `src/components/teacher/TeacherAttendanceMonthlyBreakdown.tsx`, `src/components/admin/ImportAttendanceDialog.tsx`, `src/components/admin/ImportTeacherAttendanceDialog.tsx`, plus a new shared `src/hooks/useAttendanceQuery.ts` for the single query layer.

## 9. Phase 3 validation (after approval)

Role-by-role checks for admin, co-admin, teacher and student on both domains; direct Supabase calls with tampered IDs to prove RLS blocks them; enrollment/exit/archived date rules; frozen-period write rejection at the database level; build and TypeScript checks.

## Open question

Statuses: the plan standardises on **Present / Absent** because that is all the database can store and all that exists in the data. Say the word if you want Late and Excused added to the enum instead.
