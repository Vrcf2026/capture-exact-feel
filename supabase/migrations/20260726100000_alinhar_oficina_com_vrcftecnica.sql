-- Alinha o schema da Oficina com o vrcftecnica real: estados, checklist,
-- acessórios, diagnóstico técnico, observações, prazo estimado, auto-status,
-- e torna o bucket de anexos privado (como no sistema original).

-- 1. Estados reais (recebido -> diagnostico -> orcamento -> aprovado/nao_aprovado
--    -> em_reparacao/sem_reparacao -> concluido -> entregue)
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE public.work_orders ALTER COLUMN status SET DEFAULT 'recebido';
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_status_check CHECK (status IN (
  'recebido','diagnostico','orcamento','aprovado','nao_aprovado',
  'em_reparacao','sem_reparacao','concluido','entregue'
));
-- Ordens já criadas com os estados antigos (inventados por engano) migram para o mais próximo real.
UPDATE public.work_orders SET status = 'recebido' WHERE status = 'rececionado';
UPDATE public.work_orders SET status = 'diagnostico' WHERE status = 'em_diagnostico';
UPDATE public.work_orders SET status = 'orcamento' WHERE status = 'aguardar_aprovacao';
UPDATE public.work_orders SET status = 'concluido' WHERE status = 'pronto';
UPDATE public.work_orders SET status = 'nao_aprovado' WHERE status = 'cancelado';

-- 2. Checklist: array de {item, status, notas}, não objeto de booleanos.
ALTER TABLE public.work_orders ALTER COLUMN checklist SET DEFAULT '[]'::jsonb;
UPDATE public.work_orders SET checklist = '[]'::jsonb WHERE jsonb_typeof(checklist) = 'object';

-- 3. Campos em falta face ao vrcftecnica real.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cliente_rapido boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS diagnostico_tecnico text DEFAULT '';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS observacoes_incluir_pdf boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS auto_status_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS prazo_estimado timestamptz;

-- 4. Bucket de anexos passa a privado (o real nunca foi público).
UPDATE storage.buckets SET public = false WHERE id = 'anexos';
