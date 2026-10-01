# Co-Admins page: same role-change and archive flow as other profiles

## Problem

The Co-Admins screen only has "Revoke", which dumps the person back to an unapproved student and triggers the profile-completion prompt. Other profiles (students, teachers) are managed through the Edit Profile screen, which supports changing roles and archiving. Co-admins should be managed the same way.

## What changes on the Co-Admins screen

Each co-admin row gets the same actions other profiles get:

1. **Edit Profile** — opens the existing Edit Profile screen for that person, where role change and archive already work with all permission checks.
2. **Change Role** — a dropdown on the row to move the person to Student, Teacher, or Admin:
   - Student: co-admin role removed; profile becomes an approved student (no re-approval, no profile-completion reset — `profile_completed` and `approved` stay untouched).
   - Teacher: co-admin role removed, profile role set to teacher, and a teacher record is created if missing (same as the approval flow).
   - Admin: co-admin role swapped for admin role.
3. **Archive** — with a confirmation dialog, uses the same archive process as other profiles: the person can no longer sign in and appears under Archived Profiles, restorable from there. Role is preserved as-is.

The old "Revoke" button (downgrade to unapproved student) is removed.

## Permissions (same rules as Edit Profile)

- Only a main admin can change a co-admin's role or archive a co-admin. Co-admins viewing this page see the list but no action buttons (they already cannot modify admin roles elsewhere).

## Technical notes

- `src/pages/admin/CoAdmins.tsx`: replace `revoke()` with `changeRole(id, newRole)` and `archive(id)`:
  - `changeRole` deletes the `co_admin` row from `user_roles`, inserts the new role row when admin, updates `profiles.role` (`admin` for admin, `teacher`/`student` otherwise) without touching `approved`/`profile_completed`, and creates a `teachers` record when switching to teacher — mirroring the logic already in `src/pages/admin/EditProfile.tsx` (lines ~327–370).
  - `archive` calls the existing `archive_profile` function with the acting admin's id — same as Edit Profile's archive.
- The acting user's role is checked via the existing `is_admin` function to decide whether action buttons render.
- No database/schema changes; `archive_profile`, `restore_profile`, and Archived Profiles already handle the rest.
