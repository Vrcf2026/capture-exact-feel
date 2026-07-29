UPDATE public.work_orders SET status = CASE status
  WHEN 'rececionado' THEN 'recebido'
  WHEN 'em_diagnostico' THEN 'diagnostico'
  WHEN 'aguardar_aprovacao' THEN 'orcamento'
  WHEN 'pronto' THEN 'concluido'
  WHEN 'cancelado' THEN 'nao_aprovado'
  ELSE status END;
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE public.work_orders ALTER COLUMN status SET DEFAULT 'recebido';
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_status_check CHECK (status = ANY (ARRAY['recebido','diagnostico','orcamento','aprovado','nao_aprovado','em_reparacao','sem_reparacao','concluido','entregue']));