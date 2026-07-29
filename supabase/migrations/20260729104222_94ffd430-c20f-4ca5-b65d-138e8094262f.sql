ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS diagnostico_tecnico TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_incluir_pdf BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_estimado DATE,
  ADD COLUMN IF NOT EXISTS auto_status_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_rapido BOOLEAN NOT NULL DEFAULT false;