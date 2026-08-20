CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.backup_cron (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.backup_cron TO service_role;
ALTER TABLE public.backup_cron ENABLE ROW LEVEL SECURITY;

INSERT INTO public.backup_cron (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "backups sem acesso direto (select)" ON storage.objects FOR SELECT USING (false);
CREATE POLICY "backups sem acesso direto (insert)" ON storage.objects FOR INSERT WITH CHECK (false);

SELECT cron.schedule(
  'vrcf-backup-diario',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--d2108d59-b29f-4ad3-9a3f-bdc5ab77de5a.lovable.app/api/public/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-secret', (SELECT token FROM public.backup_cron WHERE id)
    ),
    body := '{}'::jsonb
  );
  $$
);