# Teacher Attendance and Roster Repair

## Goal

Restore the complete teacher workflow: view assigned students with names/details, mark their attendance, and view the teacher’s own attendance after an admin or co-admin records it.

## Confirmed findings

- The teacher is assigned to 3 classes, and all 3 classes have matching `class_enrollments` rows.
- The teacher-facing pages first query `class_enrollments`, but its current read policies only allow admins/co-admins and each student viewing their own enrollment. Teachers therefore receive an empty enrollment list.
- Teachers can read student records through `teacher_has_student`, but there is no corresponding policy allowing them to read the linked students’ profile rows. The UI consequently falls back to a generic name or displays only the student ID.
- The teacher’s `teacher_attendance` table currently contains 0 records. Its own-record read policy exists, so the page can only show an empty state until admin/co-admin attendance is saved.
- Teacher class assignments and student enrollment data are present; this repair should change access rules and query/error handling, not recreate roster data.

## Implementation

### 1. Repair teacher roster access

- Add a narrowly scoped read policy on `class_enrollments` so a teacher can view enrollments only for classes assigned to their teacher record.
- Add a narrowly scoped read policy on `profiles` so a teacher can view only profiles belonging to students in their assigned classes.
- Keep student PII restricted to the fields the teacher UI needs; do not make profiles or enrollments public.
- Reuse security-definer helper functions to avoid recursive RLS checks.

### 2. Fix class roster and My Students queries

- Update the class details dialog and My Students page to load enrollments, student records, and permitted profile details with explicit error handling.
- Show each student’s name, avatar, student ID, class, and section consistently.
- Deduplicate students assigned through multiple subjects/classes.
- Distinguish “no students enrolled” from “could not load students” so an access failure is not presented as an empty roster.

### 3. Restore teacher student-attendance marking

- Update Mark Attendance to surface enrollment/student/attendance query failures and retain only students eligible on the selected date.
- Preserve the existing rules: the teacher must be assigned to the class, the student must be enrolled, and the date must be on or after enrollment.
- Verify present/absent upserts for both initial save and later update, including frozen-year blocking.

### 4. Make My Attendance reliable

- Add complete query error handling when resolving the teacher record, financial year, attendance rows, and class labels.
- Keep the page’s empty state when no attendance has actually been recorded, with wording that clarifies admin/co-admin must mark it first.
- Verify that an admin/co-admin attendance entry becomes visible only to the matching teacher and appears in charts, monthly totals, and history.

### 5. End-to-end verification

- As the assigned teacher, confirm all 4 enrolled students are visible across the appropriate 3 classes with names and details.
- Confirm My Students shows the distinct assigned students rather than an empty list.
- Mark and update student attendance for a valid date; test rejection before enrollment and for an unassigned class.
- As admin/co-admin, mark the teacher present/absent on or after the joining date, then confirm it appears in the teacher’s My Attendance page.
- Test that a different teacher cannot read these roster/profile/attendance rows.
- Run the Supabase security linter and targeted frontend tests.

## Technical scope

- Database migration: teacher-scoped read policies/helper functions only; no public access and no data reset.
- Frontend: `ClassDetailsDialog`, `TeacherStudents`, `TeacherAttendanceMark`, and `TeacherMyAttendance`.
- Existing enrollment synchronization, ID generation, attendance date validation, and admin/co-admin permissions remain intact.