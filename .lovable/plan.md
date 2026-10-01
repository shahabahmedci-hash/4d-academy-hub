# Effective-dated class schedules — Phase 1 audit and plan

## Audit findings

**Why history changes today (root cause, confirmed in code)**
- A class row in `classes` holds a single `day_of_week`, `start_time`, `end_time`. There is no start/end date for a schedule.
- `EditClassDialog` overwrites `day_of_week` in place, so the previous timetable is lost.
- Every session calculation re-reads the *current* `day_of_week` and applies it to all past dates:
  - `useAttendanceCoverage.ts` `buildSessions` (Coverage page, dashboard "unmarked" alert)
  - `sessionDates.ts` `isMarkableSessionDate` / `latestSessionOnOrBefore` (marking calendars) and `countPersonSessions` (history "Scheduled / Marked / Not marked" strip)
  - `Attendance.tsx` and `TeacherAttendance.tsx` load a `dowByClass` map from current `classes`
- `countPersonSessions` also uses the person's first attendance record as the start date — it infers sessions from attendance, which the new rule forbids.
- Schedule screens (`Classes.tsx`, `StudentSchedule.tsx`, `TeacherClasses.tsx`, `TeacherDashboard.tsx`, `StudentDashboard.tsx`, `TeacherDetails.tsx`, `ClassDetailsDialog.tsx`) read `day_of_week` directly — each is a separate calculation.

**Live data (queried)**
- 3 classes, each a unique subject + class + batch; one weekday per class.
- 25 student attendance rows (earliest 2026-08-04), all on the class's current weekday.
- 21 teacher attendance rows; **3 fall on a weekday that does not match the class's current schedule.** These are either from an earlier schedule or marked on an off-day. The original schedule cannot be reliably reconstructed — this is the one ambiguity to resolve with you (see Migration step 3).
- No schedule history, holiday or cancellation data exists anywhere.

**Kept as-is**: attendance tables, uniqueness, RLS, enrollment/joining/exit triggers, `enforce_attendance_freeze`, teacher `class_id` linkage.

**Teacher Attendance filters**: the "Class" dropdown currently lists subject rows. It will be split into separate Subject, Class (grade) and Batch (section) selections, then Date.

## Proposed architecture

```text
classes (subject, class, section, teacher)        <- identity only
   |
class_schedules (class_id, weekday, start/end time,
                 effective_from, effective_to)     <- history, never overwritten
   |
schedule_exceptions (class_id, date, type:
   cancelled | rescheduled | holiday, new_date, note)
   + holidays (date, label) for academy-wide non-working days
   |
get_scheduled_sessions(from, to, class_id?)        <- ONE database function
   |
student attendance / teacher attendance / coverage / schedules
```

- A class can have several weekly slots (e.g. Mon + Wed) within one effective period.
- Changing the timetable = close the current period (`effective_to` = day before) and add a new one from the chosen date. Past periods become read-only once any attendance exists in them.
- `get_scheduled_sessions` expands periods into dates, removes holidays and cancelled dates, moves rescheduled sessions to their new date, and returns `class_id, date, start/end time, is_frozen`.
- A companion `get_attendance_coverage(from, to, domain)` joins sessions with eligibility (enrollment/exit dates, archived, class membership; teacher assignment + joining date) and attendance, returning expected / marked / unmarked per session. Unmarked = real session + eligible + no record.
- A validation trigger on both attendance tables rejects new/edited records for dates that are not a scheduled session (admins may override, matching the existing freeze rule). Existing rows are not touched.
- `classes.day_of_week` / times stay as a read-only mirror of the current schedule so nothing else breaks during rollout.

## Migration strategy (no data deleted or rewritten)

1. Create the new tables, GRANTs, RLS (admin/co-admin manage; teachers/students read schedules for their own classes), indexes, and the two functions.
2. Seed one schedule period per class from its current weekday/times, starting at the earliest of: class creation date or first attendance date.
3. The 3 off-schedule teacher records: by default keep them untouched and add a one-off "rescheduled/extra session" exception for each date so they count as real sessions. Alternative: leave them flagged as "outside schedule" in an admin review list. You'll be asked to choose before implementation.
4. Switch all screens to the shared functions; remove the duplicated weekday maths from `sessionDates.ts` and `useAttendanceCoverage.ts`.

## UI changes

- Class Schedule: per class, list schedule periods; "Change schedule from date…" instead of editing the weekday in place; manage cancellations/reschedules; academy holiday list.
- Student/Teacher schedule and dashboards: today's classes come from the session function.
- Marking calendars (admin, co-admin, teacher): only real session dates enabled; cancelled dates shown as cancelled.
- History strip and Coverage: use the session/coverage functions only.
- Teacher Attendance: Teacher → Subject → Class → Batch → Date filters.

## Testing plan

- Schedule change: Mon/Wed Jun–Aug, switch to Tue/Thu from Sep 1 → June–August sessions, coverage and unmarked counts unchanged; September uses Tue/Thu.
- Back-dated change attempt into a period with attendance → blocked.
- Cancelled session → no unmarked; marking blocked. Holiday → same for all classes.
- Rescheduled session → appears on new date only; attendance on new date counts.
- Eligibility: student enrolled mid-period / exited / archived; teacher joined mid-period → no unmarked before/after.
- Frozen year → marking rejected; sessions still shown in history.
- Attendance row counts before/after migration identical (25 / 21).
- Role checks: admin, co-admin, teacher (own classes only), student (own only).

## Technical notes

- New: `class_schedules`, `schedule_exceptions`, `holidays`; functions `get_scheduled_sessions`, `get_attendance_coverage`, `is_scheduled_session`; trigger `validate_attendance_session`.
- Edited: `AddClassDialog`, `EditClassDialog`, `Classes.tsx`, `StudentSchedule.tsx`, `TeacherClasses.tsx`, both dashboards, `TeacherDetails.tsx`, `ClassDetailsDialog.tsx`, `Attendance.tsx`, `TeacherAttendance.tsx`, `TeacherAttendanceMark.tsx`, `AttendanceCoverage.tsx`, `AdminDashboard.tsx`, `useAttendanceCoverage.ts`, `sessionDates.ts`.
- Base project untouched.
