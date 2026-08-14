ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.catalogo ADD COLUMN IF NOT EXISTS codigo text;
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_codigo_uidx ON public.catalogo (lower(codigo)) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_nome_idx ON public.clientes (lower(nome));