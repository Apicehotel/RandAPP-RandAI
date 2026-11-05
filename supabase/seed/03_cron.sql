-- Pianificazioni (pg_cron + pg_net) della nuova app. Nessun segreto qui: il segreto di chiamata si legge dalla tabella
-- public.edge_function_secrets (chiave sensor_sync_secret) al momento dell'esecuzione. Non toccano i job della vecchia app.
-- Eseguito il 2026-11-04. Per fermarli: select cron.unschedule('randapp-notify-run'); (idem per gli altri due).
select cron.schedule('randapp-notify-run', '* * * * *', $$select randapp.notify_run();$$);

select cron.schedule('randapp-notify-dispatch', '* * * * *', $$select net.http_post(
  url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/notify-dispatch',
  headers := jsonb_build_object('content-type','application/json','x-sync-secret',(select value from public.edge_function_secrets where key='sensor_sync_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 20000);$$);

select cron.schedule('randapp-ewelink-sync', '*/10 * * * *', $$select net.http_post(
  url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/ewelink-sync',
  headers := jsonb_build_object('content-type','application/json','x-sync-secret',(select value from public.edge_function_secrets where key='sensor_sync_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 20000);$$);
