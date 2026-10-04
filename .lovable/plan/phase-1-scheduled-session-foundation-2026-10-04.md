# Phase 1 — Scheduled Session Foundation

## Where things stand (checked)

Already in place from the last round:
- Dated timetables (`class_schedules` with effective from/to), one-off changes (`schedule_exceptions`) and `holidays`.
- One shared date source, `get_scheduled_sessions`, used by marking calendars, history totals, Coverage and dashboards.
- Attendance can't be saved for a date the class didn't meet (main admin can override). Past timetable periods that already have attendance can't be changed.
- Freeze/Unfreeze: `financial_years` can only be changed by the main admin; co-admins can only view. This stays as it is.

Still missing for this phase:
1. **Sessions aren't stored.** They're calculated fresh every time from the timetable. They're correct today, but nothing actually stores "this session happened". There's also no session status (scheduled / cancelled / rescheduled), no link back to its source, and no created/updated record.
2. **"Unmarked" is counted in the app, in two places**: the Coverage hook and the history totals in `sessionDates.ts`. Both use the same sessions but apply the eligibility rules separately, so they could disagree.
3. Three screens still group classes by the old weekday field on `classes` instead of the dated timetable: Teacher Details, Class Details dialog and the Teacher Attendance class list. These only affect what's displayed, not history.

## What will be built

### 1. Stored sessions table: `class_sessions`
One row per class per date:
- class, batch (section copied from the class), session date, start/end time
- `status`: scheduled | cancelled | rescheduled
- `kind`: regular | extra | rescheduled_to
- source: `schedule_id` (timetable period) or `exception_id`
- `rescheduled_to_date`, created_at/by, updated_at/by
- Unique on (class, date, start time)

### 2. Keeping sessions stable
- `generate_class_sessions(class_id, from, to)` creates sessions from the timetable that was in effect on each date, then applies exceptions and holidays.
- **Past sessions are locked.** No generator or schedule change can modify or delete a session dated before today, or any session that has attendance. A timetable change from date X only replaces future, unmarked sessions on or after X.
- Triggers on `class_schedules`, `schedule_exceptions` and `holidays` regenerate only the affected future range. A cancelled date or holiday marks the session as `cancelled` rather than deleting it.
- A daily job (the existing cron dispatcher) keeps sessions created up to 90 days ahead.

### 3. Filling in existing history
- For every class, create sessions from the start of its existing timetable period up to 90 days ahead. That's the same start already used (class creation date or first attendance, whichever is earlier).
- No attendance rows are touched. Before and after counts are checked: 25 student rows and 21 teacher rows.
- The 3 off-schedule teacher records get no invented session. They stay listed under "Needs review" and are reported again.

### 4. One place for the Unmarked rule
- `get_scheduled_sessions` reads from `class_sessions` (status = scheduled). It keeps the same name and output, so the screens keep working.
- New `get_unmarked_attendance(from, to, domain, class_id?, person_id?)` returns one row per session × eligible person × no record:
  - Students: enrolled in the class, on or after their enrollment date, before their exit date, not archived.
  - Teachers: assigned to the class, on or after their joining date, not archived.
  - Dates in frozen years are excluded, matching what you see today.
- No session means no row, so it can never produce Unmarked.
- RLS rules stay as they are: admin and co-admin see everything, teachers see their own classes, students see only themselves.

### 5. Code cleanup (small changes, no redesign)
- `useAttendanceCoverage.ts` and `countPersonSessions` in `sessionDates.ts` will use `get_unmarked_attendance` for their numbers. The separate eligibility and date maths will be removed.
- Teacher Details, Class Details and the Teacher Attendance class list will show the current timetable via `fetchCurrentWeeklySlots`.
- No layout changes.

### 6. Unchanged
Fees, expenses, financial-year behaviour, Freeze/Unfreeze (main admin only), authentication, roles, existing attendance RLS, and the attendance tables themselves.

## Database checks before finishing
These run in a transaction that is rolled back, so no real data changes:
1. Make a timetable change from a future date. Sessions dated before it are identical (same rows, times and source).
2. Unmarked count for past dates is the same before and after that change.
3. Attendance row counts are the same before and after (25 / 21).
4. A test class on Mon/Wed from Jun 1, then Tue/Thu from Sep 1: June–August sessions fall on Mon/Wed and September on Tue/Thu.
5. Cancelled date, holiday and a date with no session return zero Unmarked.
6. A co-admin trying to change `financial_years` is rejected; the main admin succeeds.

## Technical details
- Migration: create `class_sessions` (GRANT select to authenticated, all to service_role; RLS: authenticated read, admin/co-admin manage; writes mainly through security-definer functions). Add `generate_class_sessions`, `regenerate_future_sessions` and lock/regenerate triggers. Rewrite the body of `get_scheduled_sessions` and `is_scheduled_session`, keeping the same signatures. Add `get_unmarked_attendance` (execute for authenticated only). Run the backfill with `run_sql`.
- The extend-sessions task is added to the automation dispatcher.
- Frontend files: `src/hooks/useAttendanceCoverage.ts`, `src/lib/sessionDates.ts`, `src/lib/scheduledSessions.ts`, `src/pages/admin/Attendance.tsx`, `src/pages/admin/TeacherAttendance.tsx` (history counts plus class list), `src/pages/admin/TeacherDetails.tsx`, `src/components/teacher/ClassDetailsDialog.tsx`.
- Summary at the end lists: tables and migrations, functions, RLS changes, frontend files, data safety notes and data that couldn't be mapped.
