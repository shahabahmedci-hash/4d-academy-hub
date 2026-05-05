ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

INSERT INTO public.automation_settings (task_key, label, description, enabled, frequency, day_of_month, day_of_week, cron_expression)
VALUES
  ('process-recurring-templates', 'Process recurring templates', 'Generate fees, salaries and expenses from recurring templates (IST)', true,  'daily',   1, 1, '0 1 * * *'),
  ('auto-mark-overdue',           'Auto-mark overdue fees',     'Mark pending fees with past due_date as overdue (IST)',         true,  'daily',   1, 1, '0 2 * * *'),
  ('send-fee-reminders',          'Send fee reminders',         'Notify students whose fees are due within 3 days or overdue',   true,  'daily',   1, 1, '0 9 * * *'),
  ('auto-attendance-summary',     'Auto attendance summary',    'Generate daily attendance summary notifications',               false, 'daily',   1, 1, '0 18 * * *')
ON CONFLICT DO NOTHING;