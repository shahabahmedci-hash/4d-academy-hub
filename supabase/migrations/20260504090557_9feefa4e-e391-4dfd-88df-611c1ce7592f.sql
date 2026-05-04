-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Seed default automation rows if missing
INSERT INTO public.automation_settings (task_key, label, description, enabled, frequency, day_of_month, cron_expression)
SELECT 'generate_fees', 'Generate monthly student fees',
       'Creates pending fee records from active fee templates on the configured day of each month.',
       false, 'monthly', 1, '0 2 1 * *'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_settings WHERE task_key = 'generate_fees');

INSERT INTO public.automation_settings (task_key, label, description, enabled, frequency, day_of_month, cron_expression)
SELECT 'generate_salaries', 'Generate monthly teacher salaries',
       'Creates pending salary records from active salary templates on the configured day of each month.',
       false, 'monthly', 1, '0 2 1 * *'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_settings WHERE task_key = 'generate_salaries');