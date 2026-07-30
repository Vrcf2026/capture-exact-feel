ALTER TABLE public.utilizadores ADD COLUMN IF NOT EXISTS deve_trocar_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.login_tentativas (
  nome text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz
);
GRANT ALL ON public.login_tentativas TO service_role;
ALTER TABLE public.login_tentativas ENABLE ROW LEVEL SECURITY;