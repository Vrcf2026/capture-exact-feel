-- Bucket público para fotos/anexos das ordens de serviço da Oficina.
-- Upload feito sempre via server functions com service_role (RLS não se aplica ao service_role).
-- Bucket "público" permite ler as imagens pelo URL direto, sem precisar de políticas extra de SELECT.
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;
