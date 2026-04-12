create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'osgb-daily-document-batch';

select cron.schedule(
  'osgb-daily-document-batch',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://elmdzekyyoepdrpnfppn.supabase.co/functions/v1/osgb-daily-batch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
