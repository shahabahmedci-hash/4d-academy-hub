DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-cron-hourly') THEN
    PERFORM cron.unschedule('automation-cron-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-dispatcher-hourly') THEN
    PERFORM cron.unschedule('automation-dispatcher-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'automation-dispatcher-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fchnqcxlgssjbrfeqpuf.supabase.co/functions/v1/automation-dispatcher',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaG5xY3hsZ3NzamJyZmVxcHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjczNjIsImV4cCI6MjA5MTA0MzM2Mn0.E9BWKm4sAhOM4ntpcHME5tZ9OXAFhBRzgdaOiAQ-Swk"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);