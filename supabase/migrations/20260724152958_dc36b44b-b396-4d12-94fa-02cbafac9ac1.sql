
-- =========================================================
-- VRCF: schema completo (Loja + Oficina) com auth custom
-- Todo o acesso passa por server functions com service_role.
-- RLS ativa em tudo, sem policies -> anon/authenticated bloqueados.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Utilizadores (login nome + password) ----------
CREATE TABLE public.utilizadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('admin','operador','tecnico')),
  acesso_loja boolean NOT NULL DEFAULT true,
  acesso_oficina boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.utilizadores TO service_role;
ALTER TABLE public.utilizadores ENABLE ROW LEVEL SECURITY;

-- ---------- Vendedores (PIN only) ----------
CREATE TABLE public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  pin_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.vendedores TO service_role;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- ---------- Catálogo (partilhado Loja + Oficina) ----------
CREATE TABLE public.catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('produto','servico')),
  preco numeric(10,2) NOT NULL DEFAULT 0,
  preco2 numeric(10,2) NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'unidade',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.catalogo (ativo);
CREATE INDEX ON public.catalogo (nome);
GRANT ALL ON public.catalogo TO service_role;
ALTER TABLE public.catalogo ENABLE ROW LEVEL SECURITY;

-- ---------- Clientes ----------
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nif text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.clientes (nome);
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ---------- Caixa diário ----------
CREATE TABLE public.caixa_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  valor_inicial numeric(10,2) NOT NULL DEFAULT 0,
  valor_final_contado numeric(10,2),
  aberto_em timestamptz NOT NULL DEFAULT now(),
  aberto_por uuid NOT NULL REFERENCES public.utilizadores(id),
  fechado_em timestamptz,
  fechado_por uuid REFERENCES public.utilizadores(id),
  observacoes text
);
CREATE UNIQUE INDEX caixa_diario_um_aberto ON public.caixa_diario (data) WHERE fechado_em IS NULL;
GRANT ALL ON public.caixa_diario TO service_role;
ALTER TABLE public.caixa_diario ENABLE ROW LEVEL SECURITY;

-- ---------- Saídas de caixa ----------
CREATE TABLE public.saidas_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid NOT NULL REFERENCES public.caixa_diario(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NOT NULL REFERENCES public.utilizadores(id)
);
CREATE INDEX ON public.saidas_caixa (caixa_id);
GRANT ALL ON public.saidas_caixa TO service_role;
ALTER TABLE public.saidas_caixa ENABLE ROW LEVEL SECURITY;

-- ---------- Registos de venda ----------
CREATE TABLE public.registos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigserial UNIQUE,
  data timestamptz NOT NULL DEFAULT now(),
  cliente_id uuid REFERENCES public.clientes(id),
  utilizador_id uuid REFERENCES public.utilizadores(id),
  vendedor_id uuid REFERENCES public.vendedores(id),
  total numeric(10,2) NOT NULL DEFAULT 0,
  faturado boolean NOT NULL DEFAULT false,
  faturado_em timestamptz,
  faturado_por uuid REFERENCES public.utilizadores(id),
  anulado boolean NOT NULL DEFAULT false,
  anulado_em timestamptz,
  anulado_por uuid REFERENCES public.utilizadores(id),
  anulado_motivo text,
  editado_em timestamptz,
  editado_por uuid REFERENCES public.utilizadores(id),
  notas text,
  CHECK ( (utilizador_id IS NOT NULL) OR (vendedor_id IS NOT NULL) )
);
CREATE INDEX ON public.registos (data);
CREATE INDEX ON public.registos (cliente_id);
GRANT ALL ON public.registos TO service_role;
ALTER TABLE public.registos ENABLE ROW LEVEL SECURITY;

-- ---------- Itens de venda ----------
CREATE TABLE public.registo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registo_id uuid NOT NULL REFERENCES public.registos(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.catalogo(id),
  descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) GENERATED ALWAYS AS (ROUND(quantidade * preco_unitario, 2)) STORED
);
CREATE INDEX ON public.registo_itens (registo_id);
GRANT ALL ON public.registo_itens TO service_role;
ALTER TABLE public.registo_itens ENABLE ROW LEVEL SECURITY;

-- ---------- Pagamentos ----------
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registo_id uuid NOT NULL REFERENCES public.registos(id) ON DELETE CASCADE,
  metodo text NOT NULL CHECK (metodo IN ('dinheiro','mb','transferencia','conta_corrente','cheque','outro')),
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  data timestamptz NOT NULL DEFAULT now(),
  liquidado boolean NOT NULL DEFAULT true, -- false apenas para conta-corrente em aberto
  liquidado_em timestamptz,
  liquidado_por uuid REFERENCES public.utilizadores(id),
  notas text
);
CREATE INDEX ON public.pagamentos (registo_id);
CREATE INDEX ON public.pagamentos (metodo, liquidado);
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- ---------- Ordens de serviço (Oficina) ----------
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigserial UNIQUE,
  status text NOT NULL DEFAULT 'rececionado' CHECK (status IN (
    'rececionado','em_diagnostico','aguardar_aprovacao','aprovado',
    'em_reparacao','pronto','entregue','cancelado'
  )),
  cliente_id uuid REFERENCES public.clientes(id),
  cliente_nome text,
  contacto text,
  equipamento text,
  marca_modelo text,
  num_serie text,
  password_pin text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  acessorios jsonb NOT NULL DEFAULT '[]'::jsonb,
  sintomas_cliente text,
  data_rececao timestamptz NOT NULL DEFAULT now(),
  tecnico_id uuid REFERENCES public.utilizadores(id),
  valor_estimado numeric(10,2),
  aprovado_por text,
  meio_aprovacao text,
  data_aprovacao timestamptz,
  relatorio_intervencao text,
  assinatura_rececao text,
  assinatura_entrega text,
  limpeza_efetuada boolean NOT NULL DEFAULT false,
  testes_finais_ok boolean NOT NULL DEFAULT false,
  data_entrega timestamptz,
  valor_total_pago numeric(10,2),
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.work_orders (status);
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.work_order_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.catalogo(id),
  descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) GENERATED ALWAYS AS (ROUND(quantidade * preco_unitario, 2)) STORED
);
CREATE INDEX ON public.work_order_itens (work_order_id);
GRANT ALL ON public.work_order_itens TO service_role;
ALTER TABLE public.work_order_itens ENABLE ROW LEVEL SECURITY;

-- ---------- Company settings ----------
CREATE TABLE public.company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  nome text,
  morada text,
  nif text,
  contacto text,
  email text,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.company_settings (id, nome) VALUES (true, 'VRCF') ON CONFLICT DO NOTHING;

-- ---------- Trigger: updated_at em work_orders ----------
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER work_orders_touch BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
