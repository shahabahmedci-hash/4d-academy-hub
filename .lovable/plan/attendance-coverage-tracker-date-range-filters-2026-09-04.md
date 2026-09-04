# Attendance Coverage Tracker + Date Range Filters

Two additions for admin and co-admin: a coverage panel that finds class sessions where attendance was never marked (or only partly marked), and date-range selection everywhere attendance is viewed.

## 1. Attendance Coverage page

New page at `/admin/attendance/coverage`, reachable from a "Coverage" button on both the Student Attendance and Teacher Attendance admin pages, plus a summary card on the admin dashboard showing the count of unmarked sessions in the last 30 days.

How a "session" is determined: each class row has a `day_of_week`, so every calendar date in the chosen range that matches a class's weekday is an expected session for that class. Frozen financial-year dates and dates before the class had any enrolled member are skipped.

For every expected session the panel computes:

- Students: eligible students on that date (enrolled, not exited, not archived) vs. attendance rows saved for that class+date.
- Teachers: teachers assigned to the class who had joined by that date vs. teacher attendance rows.

Each row is then labelled:

```text
Complete   12 of 12 marked
Partial     3 of 12 marked
Missing     0 of 12 marked
```

Panel behaviour:

- Domain toggle: Students / Teachers (both available in one list view).
- Date range picker (user-chosen start and end, defaults to the last 30 days).
- Filters: class, batch, and coverage status (All / Missing / Partial / Complete).
- Summary counters at the top: expected sessions, complete, partial, missing.
- Each row is clickable and deep-links straight into the existing marking screen with the class, batch and date preselected, so the admin can finish the session immediately.
- Sorted oldest-missing first so the longest-outstanding gaps surface at the top.
- CSV export of the coverage list.

## 2. Date range in attendance views

The single-date pickers in the history views become range pickers:

- Admin Student Attendance history
- Admin Teacher Attendance history
- Teacher "My Attendance"
- Student Attendance

Each gets a range control with quick presets (Today, Last 7 days, This month, Last 30 days, Custom range) and "Any date" as the cleared state. Lists, counters, pie charts and monthly breakdowns all keep reading from the same single filtered dataset, so the statistics follow the selected range. Marking screens keep their existing single-date calendar — a session is marked for one day.

## Technical notes

- Coverage computation lives in a new `src/hooks/useAttendanceCoverage.ts` next to `useAttendanceQuery.ts`: one query for classes in scope, one bulk query for attendance rows in the range grouped by class+date, one for enrollments/teacher assignments, then session expansion in memory. No new tables and no schema change.
- Range filtering reuses the existing `Calendar` component in `mode="range"` inside the current popovers; helper `isWithinRange(dateStr, range)` shared by all four history views.
- Frozen periods reuse `useFinancialYearFreeze`; frozen dates are excluded from expected sessions rather than reported as missing.
- Deep links use the existing `useSearchParams` support on the admin attendance pages (`?class=&date=&tab=mark`), extended to teacher attendance.
