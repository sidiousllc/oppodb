-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior version to keep this idempotent
DO $$
DECLARE
  jid INTEGER;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'dispatch-alerts-every-5min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Schedule dispatch-alerts every 5 minutes
SELECT cron.schedule(
  'dispatch-alerts-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/dispatch-alerts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5c2J0eHB1cG13a3hvdmdrYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjU0MDEsImV4cCI6MjA4ODg0MTQwMX0.jb0f4suQAawBCj-zAh6P-HGSopsl0nQ0mGezihU52zI"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);