# Session-aware attendance for admin and co-admin

Three fixes on the admin/co-admin attendance screens (students and teachers), so attendance follows the actual class timetable the way the Coverage panel already does.

## 1. Only real class days can be picked when marking

Today the marking calendar accepts any date, so attendance can be recorded for a day when the class never met.

- Once a subject/class session is chosen, the calendar disables every date whose weekday is not the class's scheduled day.
- Future dates stay disabled, and dates inside a frozen financial year are disabled too.
- A line under the picker states when the class meets, e.g. "Meets on Tuesdays".
- On the teacher screen, dates before the selected teacher's joining date are also disabled.
- If the currently selected date stops being valid after switching class, it snaps to the most recent valid session date.

## 2. More range options in the date picker

The range picker (used in both Coverage and the attendance history views) gains:

- This quarter
- Last quarter
- This financial year (April–March)
- Last financial year
- Last 12 months

Existing options (Today, Last 7 days, This month, Last 30 days, custom start/end, Any date) stay.

## 3. History views become session-aware

The lists under the attendance screens currently count only saved rows, so they can't tell "everyone present" apart from "nobody marked".

For the selected class, batch and date range, each history view adds a summary strip:

```text
Scheduled sessions 24    Marked 21    Not marked 3
```

- Scheduled sessions are derived the same way Coverage derives them (class weekday × dates in range, skipping frozen dates, dates before anyone was enrolled/joined, and future dates) — one shared calculation, no second source of truth.
- The "Not marked" figure links straight into the Coverage page with the same class, batch and range preselected.
- Attendance rate keeps being computed from saved records; the new counters sit beside it so gaps are visible.

## Technical notes

- `src/lib/dateRange.ts`: extend `RANGE_PRESETS` with quarter/financial-year/12-month builders; `DateRangePicker` renders them in a wrapped grid so the popover stays compact.
- Marking calendars in `src/pages/admin/Attendance.tsx` and `src/pages/admin/TeacherAttendance.tsx` receive a `disabled` predicate built from the selected class's `day_of_week`, `isDateFrozen`, today, and (teacher page) `joining_date`.
- Session counting reuses `fetchStudentCoverage` / `fetchTeacherCoverage` from `src/hooks/useAttendanceCoverage.ts`, filtered client-side by the view's class/batch selection — no new queries beyond the existing ones and no schema change.
- Teacher and student portal screens are untouched; this is scoped to admin and co-admin.
