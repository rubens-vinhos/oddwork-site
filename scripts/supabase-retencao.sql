-- Oddwork · apaga sozinho os registos de visitas com mais de 13 meses (prometido na política de privacidade).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'apagar-eventos-antigos';
select cron.schedule('apagar-eventos-antigos', '15 3 * * *',
  $$delete from public.eventos where t < now() - interval '13 months'$$);
