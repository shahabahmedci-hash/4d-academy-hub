# Revoking co-admin should archive, not downgrade

## Problem

Today "Revoke" on the Co-Admins screen sets the person's role back to student and marks them unapproved. They can still sign in, land in the student portal, and get asked to complete a student profile — which is wrong for someone who was staff.

## New behaviour

Revoke becomes an archive action, matching the Archived Profiles workflow:

- The co-admin role is removed.
- The profile is archived (same archive marker used elsewhere), so the person can no longer sign in and shows up under Archived Profiles.
- The role on the profile is left as it was — no silent conversion into a student, so no profile-completion prompt.
- The confirmation dialog wording changes to explain the person will be archived and can be restored later from Archived Profiles.
- The success message becomes "Co-admin revoked and profile archived".

Restoring from Archived Profiles brings the person back exactly as before, minus the co-admin role — they would need re-approval through Approvals to regain elevated access.

## Technical notes

- `src/pages/admin/CoAdmins.tsx`: `revoke()` deletes the `user_roles` row for `co_admin`, then calls the existing `archive_profile` function with the acting admin's id, instead of updating `profiles.role`/`approved`.
- No schema change needed; `archive_profile` and `restore_profile` already exist and Archived Profiles already lists and restores archived rows.
- Only the Co-Admins page changes.
