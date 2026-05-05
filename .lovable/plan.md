
# 4D Academy Hub — Parity Plan vs Reference Repo

I cloned the public repo `shahabahmedci-hash/d-academy-connect` and compared it against our current build file-by-file (pages, components, hooks, libs, edge functions, migrations, config). Below are the concrete gaps and a batched implementation plan.

## Gap Summary

### Edge functions (ours vs reference)
| Reference function | Ours | Status |
|---|---|---|
| `process-recurring-templates` | `generate-recurring` | Different name + IST timezone logic + supports fortnightly/quarterly/yearly + expense templates — **rewrite** |
| `automation-dispatcher` | `automation-cron` | Reference dispatches 4 tasks (recurring, overdue, reminders, attendance summary) — **expand** |
| `auto-mark-overdue` | missing | **Add** |
| `send-fee-reminders` | missing | **Add** |
| `auto-attendance-summary` | missing | **Add** |
| `import-students` | missing | **Add** (server-side bulk insert with profiles + user_roles) |
| `import-teachers` | missing | **Add** |
| `ai-analytics` | `ai-insights` | Reference uses richer prompts + multi-section output — **expand** |

### Frontend components missing
- `components/admin/AddClassDialog.tsx`, `EditClassDialog.tsx`
- `components/admin/BulkPromotionDialog.tsx` (year-end class promotion)
- `components/admin/DashboardAutomationCard.tsx` (run automation tasks from dashboard)
- `components/admin/AIInsightsPanel.tsx` (full panel, ours is a small card)
- `components/admin/FinanceMonthlyBreakdown.tsx`, `FinancePieChart.tsx`
- `components/admin/ImportStudentsDialog.tsx`, `ImportTeachersDialog.tsx`, `ImportFeesDialog.tsx`, `ImportSalariesDialog.tsx`, `ImportExpensesDialog.tsx`, `ImportAttendanceDialog.tsx`, `ImportTeacherAttendanceDialog.tsx`
- `components/student/AttendanceMonthlyBreakdown.tsx`, `AttendancePieChart.tsx`, `AttendanceRecordsList.tsx`
- `components/teacher/ClassDetailsDialog.tsx`, `TeacherAttendanceMonthlyBreakdown.tsx`, `TeacherAttendancePieChart.tsx`, `TeacherAttendanceRecordsList.tsx`
- `components/shared/AdBanner.tsx`, `AppTimeIndicator.tsx`, `AvatarUpload.tsx`, `CameraCaptureDialog.tsx`
- Marketing: `components/Hero.tsx`, `Navbar.tsx`, `About.tsx`, `Courses.tsx`, `Features.tsx`, `Contact.tsx`, `Footer.tsx` (used on `/home` Index landing page)

### Libs / hooks missing
- `lib/csvImport.ts` (quote-aware CSV, IST date normalization, currency cleaning, email validation)
- `lib/csvExport.ts` — ours exists; verify parity
- `lib/downloadPreview.ts` + `pages/PreviewDownload.tsx` (in-app preview before download)
- `lib/generateReceipt.ts`, `generateSalaryReceipt.ts` (jsPDF receipts)
- `lib/invokeEdgeFunction.ts` (typed wrapper with error normalization)
- `lib/runAutomationTask.ts` (client fallback for all 4 automation tasks when edge fails)
- `lib/adConfig.ts`
- `hooks/useProfileCompletionGate.ts` (student gate — redirects to /student/profile until completed)
- `hooks/useTeacherProfileGate.ts` (teacher gate)
- `hooks/useSignedAvatarUrl.ts` (signed URL for avatars bucket)

### Pages / routes missing or different
- `/home` landing page (`pages/Index.tsx` with marketing components)
- `/preview-download` route
- Reference uses `/admin/profile/:id` instead of `/admin/edit-profile`
- Reference adds extra teacher route `TeacherAttendanceView` separate from marking
- Reference Auth.tsx contains role-specific mandatory fields on signup (father_name, class/section/stream for student; designation/subjects/joining_date for teacher; phone/address for everyone) — our Auth likely does not enforce these

### Database / behavioural differences
- Reference `recurring_templates.interval` enum supports: `monthly`, `fortnightly`, `quarterly`, `yearly`, `daily`, `weekly` — ours assumed monthly/weekly/daily only
- Reference also supports `type='expense'` recurring templates (we only have fee/salary)
- Reference uses **IST (UTC+5:30)** for all schedule comparisons — ours uses UTC
- Reference uses `month` value `YYYY-MM-01` (date string) — ours uses `YYYY-MM` label
- Reference enforces `profile_completed` gating across student/teacher portals
- Reference automation dispatcher runs hourly and matches by HH==scheduled_hour in IST

### AI / Automation
- Reference `ai-analytics` returns: financial summary, attendance trends, top defaulters, salary risk, suggested actions — multi-section JSON. Ours returns a flat `insights[]`. **Upgrade prompt + UI panel.**
- Reference `DashboardAutomationCard` lets admin trigger each automation task on-demand and shows last-run time.

### Visual / theming
- Landing page (Hero, Features, Courses, About, Contact, Footer, Navbar) — entire marketing site missing
- AdBanner shown above bottom nav on student/teacher dashboards
- AvatarUpload + CameraCaptureDialog flows on profile pages
- AppTimeIndicator (live IST clock chip in header)

---

## Batched Implementation Plan

### Batch A — Shared infra (libs + hooks)
1. Add `lib/csvImport.ts`, `lib/invokeEdgeFunction.ts`, `lib/runAutomationTask.ts`, `lib/generateReceipt.ts`, `lib/generateSalaryReceipt.ts`, `lib/downloadPreview.ts`, `lib/adConfig.ts`.
2. Add hooks `useProfileCompletionGate`, `useTeacherProfileGate`, `useSignedAvatarUrl`.
3. Add shared components `AdBanner`, `AppTimeIndicator`, `AvatarUpload`, `CameraCaptureDialog`.
4. Add `pages/PreviewDownload.tsx` + route.

### Batch B — Database alignment (migration)
1. Extend `recurring_templates.interval` to allow `fortnightly|quarterly|yearly` (text already, just remove any check constraint or add one).
2. Allow `type='expense'` on `recurring_templates` (already text — verify).
3. Add `automation_settings` rows for `auto-mark-overdue`, `send-fee-reminders`, `auto-attendance-summary`.
4. Add column `last_run_at timestamptz` to `automation_settings` for dashboard display.
5. Reschedule `pg_cron` to call new `automation-dispatcher` (hourly).

### Batch C — Edge functions (replace + add)
1. Add `process-recurring-templates` (port reference, IST, fortnightly/quarterly/yearly + expense type, idempotent).
2. Add `auto-mark-overdue`.
3. Add `send-fee-reminders` (creates notifications).
4. Add `auto-attendance-summary` (creates notifications + summary rows).
5. Replace `automation-cron` with `automation-dispatcher` calling all 4 above based on `automation_settings`.
6. Add `import-students`, `import-teachers` (service-role bulk insert into profiles + students/teachers + user_roles).
7. Upgrade `ai-insights` → `ai-analytics` with structured multi-section response.
8. Update `supabase/config.toml` accordingly. Remove `automation-cron`/`generate-recurring` if no longer needed.

### Batch D — Admin UI parity
1. `AddClassDialog`, `EditClassDialog` and wire into `Classes.tsx`.
2. `ImportStudentsDialog`, `ImportTeachersDialog`, `ImportFeesDialog`, `ImportSalariesDialog`, `ImportExpensesDialog`, `ImportAttendanceDialog`, `ImportTeacherAttendanceDialog` + buttons on each admin page.
3. `BulkPromotionDialog` (year-end class promotion) on `Students.tsx`.
4. `DashboardAutomationCard` + replace small `AIInsightsCard` with `AIInsightsPanel` on `AdminDashboard`.
5. `FinanceMonthlyBreakdown` + `FinancePieChart` on `Analytics.tsx`.
6. Add receipt download buttons (Fees, Salaries) using the new generators + PreviewDownload.
7. Move admin profile edit to `/admin/profile/:id`.

### Batch E — Student UI parity
1. Replace student attendance UI with `AttendanceMonthlyBreakdown`, `AttendancePieChart`, `AttendanceRecordsList`.
2. Apply `useProfileCompletionGate` on every student page.
3. Add mandatory profile fields enforcement (father_name, DOB, address, emergency contact, class/section/stream) before `profile_completed=true`.
4. Add `AvatarUpload` + `CameraCaptureDialog` on `Profile.tsx`.

### Batch F — Teacher UI parity
1. Add `ClassDetailsDialog`, `TeacherAttendanceMonthlyBreakdown`, `TeacherAttendancePieChart`, `TeacherAttendanceRecordsList`.
2. Split teacher attendance: marking (`/teacher/attendance`) vs viewing own (`/teacher/my-attendance` already exists — port `TeacherAttendanceView`).
3. Apply `useTeacherProfileGate`.
4. Mandatory fields: designation, subjects[], joining_date, phone, address, emergency contact.

### Batch G — Auth & landing
1. Rewrite `Auth.tsx` to enforce role-specific mandatory fields at signup.
2. Build marketing components (Hero, Navbar, Features, Courses, About, Contact, Footer) and `pages/Index.tsx` mounted at `/home`.
3. Add `AdBanner` mounting on dashboards and `AppTimeIndicator` in headers.

### Batch H — QA & polish
1. Visual diff key pages against the live reference preview using the browser tool.
2. Verify all imports/exports round-trip correctly (CSV templates downloadable from each import dialog).
3. Verify automation dispatcher fires in IST and idempotency works (run twice, no duplicates).
4. Verify AI Analytics renders all sections.

---

## Notes on order & risk
- Batch A and B are prerequisites for everything else.
- Batch C must land with Batch B's migration to avoid runtime errors on new columns.
- Batches D, E, F can be parallelized after A–C.
- Batch G is mostly cosmetic — safe to do last.
- Existing data is preserved; all migrations are additive.

Approve and I'll begin with Batch A + B together (smallest blast radius), then Batch C.
