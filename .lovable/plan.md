# Attendance, Enrollment, and ID Repair

## Goal

Make student/teacher attendance and class membership follow the required enrollment/joining dates, while restoring automatic unique ID generation for both existing and future records.

## Confirmed findings

- `students` and `teachers` currently have only the protected-field triggers; no trigger generates IDs or synchronizes `class_enrollments`.
- The ID helper functions exist, but `student_id` and `employee_id` remain nullable and are not invoked automatically.
- Teacher attendance loads every teacher assigned to a class without checking `joining_date`.
- Teacher-side student attendance depends entirely on `class_enrollments`; missing enrollment rows therefore produce “No students enrolled.”
- Admin student attendance already checks `enrollment_date`, but only after enrollment rows have been found.

## Implementation

### 1. Restore automatic student enrollment

- Add a database trigger that synchronizes a student’s `class_enrollments` whenever their class or section is created/changed.
- Match all classes with the student’s class and section, so every relevant subject is included.
- Backfill missing enrollment rows for existing students without creating duplicates.
- Keep enrollment timestamps aligned with the student’s `enrollment_date` so attendance eligibility has one consistent boundary.

### 2. Enforce student attendance eligibility

- Update both admin and teacher attendance screens to load only students whose `enrollment_date` is on or before the selected class date.
- Keep marking available to admin, co-admin, and only the teacher assigned to that class through the existing role/RLS model.
- Add database-side validation so attendance cannot be inserted for a date before the student’s enrollment date, even if the UI is bypassed.
- Preserve frozen-financial-year checks and existing attendance editing behavior.

### 3. Enforce teacher attendance eligibility

- Include `joining_date` when loading assigned teachers and exclude teachers for dates before they joined.
- Add database-side validation preventing teacher attendance before `joining_date`.
- Keep class/date scheduling, imports, exports, history, and frozen-period behavior intact.

### 4. Restore unique student and employee IDs

- Add collision-safe database triggers that generate IDs only when the field is blank.
- Build IDs from the profile name and enrollment/joining date using the existing application formats.
- Add uniqueness enforcement for non-null `student_id` and `employee_id` values.
- Backfill missing IDs for existing students and teachers; preserve any manually assigned IDs.
- Ensure protected-field triggers continue preventing students/teachers from changing admin-managed IDs.

### 5. Verify end to end

- Confirm existing students appear under every matching class after backfill.
- Test dates immediately before, on, and after student enrollment and teacher joining dates.
- Test attendance as admin/co-admin and as an assigned teacher, including a denied unassigned-teacher path.
- Create representative student/teacher records and confirm IDs are generated, unique, and retained on updates.
- Run the security linter and targeted frontend checks after the database and UI changes.

## Technical scope

- Database migration: trigger functions, triggers, validation, and unique partial indexes.
- Controlled data repair: missing enrollments and IDs only; existing IDs and attendance records are not overwritten.
- Frontend: `AdminAttendance`, `TeacherAttendanceMark`, and `TeacherAttendance` eligibility/loading logic.