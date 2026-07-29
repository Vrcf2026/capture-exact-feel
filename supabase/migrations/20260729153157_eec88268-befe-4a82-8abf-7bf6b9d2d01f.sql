-- Alinha Caixa e Vendas com as regras reais do internal-sales-ledger:
-- nomes de colunas, estado explícito, 1-fecho-por-dia com retificação admin,
-- reabertura com auditoria, e venda/saída sempre ligada à caixa do dia.

-- 1. caixa_diario: nomes reais + estado + num_fechos + reabertura
ALTER TABLE public.caixa_diario RENAME COLUMN valor_inicial TO saldo_inicial;
ALTER TABLE public.caixa_diario RENAME COLUMN valor_final_contado TO saldo_final;
ALTER TABLE public.caixa_diario RENAME COLUMN aberto_por TO utilizador_abertura_id;
ALTER TABLE public.caixa_diario RENAME COLUMN fechado_por TO utilizador_fecho_id;

ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'aberto';
UPDATE public.caixa_diario SET estado = CASE WHEN fechado_em IS NULL THEN 'aberto' ELSE 'fechado' END;
ALTER TABLE public.caixa_diario ADD CONSTRAINT caixa_diario_estado_check CHECK (estado IN ('aberto','fechado'));

ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS num_fechos integer NOT NULL DEFAULT 0;
UPDATE public.caixa_diario SET num_fechos = 1 WHERE fechado_em IS NOT NULL;
ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS reaberta boolean NOT NULL DEFAULT false;
ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS reaberta_em timestamptz;
ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS reaberta_por uuid REFERENCES public.utilizadores(id);
ALTER TABLE public.caixa_diario ADD COLUMN IF NOT EXISTS reaberta_motivo text;

DROP INDEX IF EXISTS caixa_diario_um_aberto;
CREATE UNIQUE INDEX IF NOT EXISTS caixa_diario_um_aberto_por_dia ON public.caixa_diario(data) WHERE estado = 'aberto';

-- 2. saidas_caixa: nomes reais + tipo (sangria/despesa)
ALTER TABLE public.saidas_caixa RENAME COLUMN motivo TO descricao;
ALTER TABLE public.saidas_caixa RENAME COLUMN criado_por TO utilizador_id;
ALTER TABLE public.saidas_caixa ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'despesa';
ALTER TABLE public.saidas_caixa ADD CONSTRAINT saidas_caixa_tipo_check CHECK (tipo IN ('sangria','despesa'));

-- 3. registos e pagamentos passam a ligar-se sempre à caixa do dia (regra real:
--    "não se vende sem caixa aberta"). Fica nullable no schema para não partir
--    dados já existentes, mas a aplicação passa a exigir sempre uma caixa aberta.
ALTER TABLE public.registos ADD COLUMN IF NOT EXISTS caixa_diario_id uuid REFERENCES public.caixa_diario(id);
CREATE INDEX IF NOT EXISTS registos_caixa_idx ON public.registos(caixa_diario_id);

ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS caixa_diario_id uuid REFERENCES public.caixa_diario(id);
CREATE INDEX IF NOT EXISTS pagamentos_caixa_idx ON public.pagamentos(caixa_diario_id);