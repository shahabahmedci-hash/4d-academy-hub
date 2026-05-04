DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-cron-hourly') THEN
    PERFORM cron.schedule(
      'automation-cron-hourly',
      '0 * * * *',
      $job$
        SELECT net.http_post(
          url := 'https://fchnqcxlgssjbrfeqpuf.supabase.co/functions/v1/automation-cron',
          headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaG5xY3hsZ3NzamJyZmVxcHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjczNjIsImV4cCI6MjA5MTA0MzM2Mn0.E9BWKm4sAhOM4ntpcHME5tZ9OXAFhBRzgdaOiAQ-Swk"}'::jsonb,
          body := concat('{"time": "', now(), '"}')::jsonb
        );
      $job$
    );
  END IF;
END $$;