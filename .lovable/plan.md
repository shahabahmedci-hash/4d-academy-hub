
## Goal

Bring `/admin/automations` to visual + functional parity with the reference repo (`shahabahmedci-hash/d-academy-connect`). Current page is a stripped-down version: it only exposes daily/weekly/monthly, has a raw cron text field, no Run Now, no Recurring Dues templates section, and a bare header.

## Gaps vs reference

### Automated Tasks card
- Only 3 frequencies → reference supports **daily, weekly, fortnightly, monthly, quarterly, half_yearly, yearly**.
- Raw cron `<Input>` → reference uses **Hour (12h labels) + Minute (00/15/30/45)** pickers and builds the cron itself.
- No **Day of Week** name dropdown (Sun–Sat) for weekly/fortnightly.
- No **Day of Month** dropdown (1–28) for monthly/quarterly/half_yearly/yearly.
- No **Run Now** button per task (with confirm dialog).
- No friendly label mapping (`process-recurring-templates` → "Auto-Generate Dues", etc.).
- No auto-built human description ("Runs monthly on 5th at 9:00 AM").
- Optimistic update + rollback on failure missing.
- Header lacks logo, NotificationBell, ThemeToggle.
- No mobile card layout — only one responsive grid.

### Recurring Dues Setup card (completely missing)
- Tabs: Fees / Salaries / Expenses, each backed by `recurring_templates` table.
- Add / Edit / Delete dialog with fields: type, student/teacher/admin, amount, interval (monthly/quarterly/yearly), day_of_month, notes, category (for expenses), is_active toggle.
- Admin-personal expense category requires selecting an admin/co-admin (only main admin sees admins list).
- Desktop table + mobile cards, inline is_active switch with optimistic update.
- Filters students to exclude teachers and admin/co-admin users, excludes archived profiles.

### Auth
- Reference gates the page with `is_admin || is_co_admin` and redirects non-admins to `/student/dashboard`. Ours only loads data.

## Implementation

### 1. Rewrite `src/pages/admin/Automations.tsx`

Replace the file with a port of the reference component, adapted to our existing imports:
- Keep our `BottomNav`, `PageSkeleton` patterns; add `NotificationBell` and `ThemeToggle` to header (already in project).
- Skip the logo asset unless one exists at `@/assets/4d-academy-logo.jpg` — fall back to the existing header style if not.
- Use `runAutomationTask` from `@/lib/runAutomationTask` (already in project) for Run Now.
- Add auth gate via `supabase.rpc("is_admin")` + `is_co_admin`; redirect to `/student/dashboard` if neither.
- Add the cron builders, parsers, friendly labels, description builder, optimistic update + rollback exactly as in reference.
- Add the Automated Tasks desktop table + mobile cards.
- Add the Recurring Dues Setup section (Tabs + Dialog + AlertDialog confirms) backed by `recurring_templates`, `students`, `teachers`, `profiles`, `user_roles`.

### 2. Verify prerequisites (read-only, no changes if present)
- `recurring_templates` table exists in `src/integrations/supabase/types.ts` (used in dashboard automation card, so it should).
- `src/lib/runAutomationTask.ts` exists (confirmed in tree).
- Confirm `automation_settings.description` column accepts the auto-generated descriptions (it already does per current update calls).

### 3. No changes to
- `automation-dispatcher` edge function (already handles all 7 frequencies correctly).
- `DashboardAutomationCard` (unchanged — it's the dashboard quick-toggle).
- Routing / nav.

## Out of scope
- Logo asset import — only if `@/assets/4d-academy-logo.jpg` is already present.
- Any backend / RLS / dispatcher changes.

## Technical notes

```text
parseCron("30 9 * * *")            → { hour: 9, minute: 30 }
buildCron(9, 30, "monthly", _, 5)  → "30 9 5 * *"
buildCron(9, 30, "quarterly", _, 5)→ "30 9 5 1,4,7,10 *"
```

Frequencies list (value/label): daily, weekly, fortnightly, monthly, quarterly, half_yearly, yearly.
