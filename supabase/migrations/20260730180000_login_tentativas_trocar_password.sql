-- Bloqueio de login por tentativas falhadas (5 erros -> 5 min bloqueado),
-- igual ao internal-sales-ledger real, mas gerido em TypeScript (a app não
-- usa funções SQL para a autenticação, usa bcrypt em código).
CREATE TABLE IF NOT EXISTS public.login_tentativas (
  nome text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz
);
GRANT ALL ON public.login_tentativas TO service_role;
ALTER TABLE public.login_tentativas ENABLE ROW LEVEL SECURITY;

-- Força troca de password no primeiro login.
ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS deve_trocar_password boolean NOT NULL DEFAULT false;
UPDATE public.utilizadores SET deve_trocar_password = true WHERE nome = 'admin';
