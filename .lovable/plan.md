# Fix login, profile saving, and ads

Three confirmed problems, plus a full function sweep against the reference app.

## 1. Remove the email confirmation step

Signup currently requires clicking an email link before login works, which the original app did not need.

- Turn on auto-confirm for email signups so admin approval is the only gate.
- Remove the "resend confirmation" fallback path from the login screen and keep only the clear "waiting for admin approval" / "account archived" messages.

## 2. Profile saving is broken (root cause confirmed)

Access rules allow a student or teacher to *read* their own record but never to *create or update* it. Admins are the only ones who can write. So when a student or teacher fills in their required profile fields and clicks Save, the write to their student/teacher record is rejected and the profile never becomes "complete" — which then keeps them locked out of the rest of the portal by the profile gate.

Fix via a database migration:
- Allow a student to create and update only their own student record, restricted to their own contact/personal fields (never their student ID, class, section or stream).
- Same for teachers on their own teacher record (contact fields only; not employee ID, designation, subjects or joining date).
- Keep admin/co-admin full control unchanged.

After the rules are in place, re-test both save flows end to end and make sure a save failure shows an error toast instead of a silent success.

## 3. Advertisements not showing

Our version routes the Adsterra script through a separate same-origin frame (`public/ad-frame.html`) and hides the banner unless it detects a creative. The reference app injects the Adsterra script directly into the page container and shows the banner as soon as an iframe appears.

- Restore the reference implementation exactly: direct script injection into the banner container, mutation-observer fill detection, dismiss button, 10s cooldown re-show.
- Remove the extra frame file and the "collapse when empty" logic that is currently hiding the banner in every case.
- Note on keys: the reference app uses ad unit `b024d75e...`; our config uses `b4f84eba...`. I will wire the reference key as the default so behaviour matches the original, and keep it a one-line change if you prefer your own unit.
- Ads still only serve on an approved, published domain with ad blocking off — the editor preview will stay empty regardless of code.

## 4. Full function sweep vs. the GitHub reference

After the three fixes, go module by module and verify behaviour matches, fixing whatever differs:

- Auth and role redirects, approval and archive gates
- Admin: students, teachers, fees, expenses, salaries, attendance (student + teacher), classes, approvals, co-admins, archived profiles, documents, financial-year freeze, automations, analytics
- Student portal: dashboard, schedule, attendance, fees + receipts, documents, profile gate
- Teacher portal: dashboard, classes, mark attendance, students, salary, documents, my attendance, profile gate
- All CSV import/export dialogs and receipt PDFs
- Edge functions: recurring templates, overdue marking, fee reminders, attendance summary, automation dispatcher, imports, AI analytics

Each broken item gets fixed in place; I will report anything that needs a decision from you rather than guessing.

## Technical notes

- Auth change is a project auth setting (`auto_confirm_email`), not code.
- Access-rule changes are a single SQL migration adding self-service insert/update policies on `students` and `teachers`, with column-level protection so users cannot change their own academic/employment data.
- Ad change reverts `src/components/shared/AdBanner.tsx` to the reference version and updates `src/lib/adConfig.ts`.
