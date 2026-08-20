ALTER TABLE public.catalogo
  ADD COLUMN IF NOT EXISTS controla_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.stock_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id uuid NOT NULL REFERENCES public.catalogo(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  motivo text,
  registo_id uuid REFERENCES public.registos(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  stock_apos numeric,
  utilizador_id uuid REFERENCES public.utilizadores(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movimentos_catalogo_idx ON public.stock_movimentos (catalogo_id, criado_em DESC);

GRANT ALL ON public.stock_movimentos TO service_role;

ALTER TABLE public.stock_movimentos ENABLE ROW LEVEL SECURITY;