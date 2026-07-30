-- Preço associado ao cliente (linha 1 ou 2 do catálogo), igual ao internal-sales-ledger real.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS linha_preco smallint NOT NULL DEFAULT 1;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_linha_preco_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_linha_preco_check CHECK (linha_preco IN (1,2));
