-- Suporte a liquidação parcial da conta-corrente (como no internal-sales-ledger real):
-- cada liquidação é um pagamento novo, não um simples "liquidado = true".
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS liquida_pagamento_id uuid REFERENCES public.pagamentos(id);
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id);
CREATE INDEX IF NOT EXISTS pagamentos_liquida_idx ON public.pagamentos(liquida_pagamento_id);
