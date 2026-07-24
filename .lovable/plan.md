
# VRCF — Fundações + Módulo Loja

App para gestão de loja de informática (com base preparada para a Oficina depois). Português de Portugal, estilo ERP sóbrio e denso (inspirado em Linear/Notion, escuro por defeito, tipografia compacta, tabelas densas).

## Entregável desta iteração

1. **Backend (Lovable Cloud / Supabase)** — schema completo das duas fases (Loja + Oficina) para não voltar a mexer nas fundações. RLS em todas as tabelas. Grants explícitos.
2. **Autenticação custom** conforme pedido:
   - `utilizadores` (nome + password_hash bcrypt, papel, `acesso_loja`, `acesso_oficina`).
   - `vendedores` (PIN, `pin_hash`) — sem sessão, só identificação em cada venda.
   - Sessão via cookie encriptado (`useSession` do TanStack Start).
   - Página `/login` com nome + password. Sem Supabase Auth.
   - Um admin inicial (`admin` / password mostrada no fim para o utilizador trocar).
3. **Shell da app** — sidebar com grupos condicionais por permissões:
   - **Loja** (Caixa, Vendas, Catálogo, Clientes, Conta-corrente, Relatórios) — visível se `acesso_loja`.
   - **Oficina** (Ordens de serviço) — placeholder, visível se `acesso_oficina` (para preencher depois).
   - **Sistema** (Utilizadores, Vendedores, Empresa) — só admin.
4. **Módulo Loja completo**:
   - **Catálogo**: listagem, criar/editar/desativar (só admin). Tipo produto/serviço, preço, preço2, unidade.
   - **Clientes**: CRUD (nome, NIF, telefone).
   - **Vendedores**: CRUD com definição de PIN (admin).
   - **Caixa diário**: abrir caixa (valor inicial), fechar caixa (reconciliação). Um caixa aberto por dia.
   - **Saídas de caixa**: registar despesa durante o dia (motivo, valor), ligada ao caixa aberto.
   - **Nova Venda**: seleccionar itens do catálogo (busca), quantidade, preço; escolher se venda é feita por utilizador (sessão) ou vendedor (PIN); registar pagamento(s) com método (dinheiro, mb, transferência, conta-corrente). Faturação e anulação como estados no registo.
   - **Registos de venda**: listagem filtrável, marcar como faturado, anular (com motivo), editar (audit trail).
   - **Conta-corrente**: por cliente, saldo em dívida vindo de pagamentos tipo "conta-corrente", com liquidação parcial/total.
   - **Relatórios**: totais por intervalo de datas (vendas, saídas, por método, por vendedor/utilizador). Exportação CSV.

## Fora do âmbito desta iteração (para depois)

- Módulo Oficina completo (OS, checklist, assinaturas, upload de anexos, PDF).
- Company settings usados em documentos (fica a tabela criada; UI depois).
- Recuperação de password (auth é custom sem email; admin faz reset).
- Passagem automática OS entregue → venda (depende do módulo Oficina).

## Detalhes técnicos

- **Stack**: TanStack Start já existente + Tailwind + shadcn/ui + Lovable Cloud.
- **Auth**: `bcryptjs` (pure JS, compatível com Worker). Sessão via `useSession` (cookie httpOnly encriptado com `SESSION_SECRET`). Todas as server functions protegidas via middleware que lê a sessão e injeta `currentUser` no contexto.
- **Papel/permissões**: helper `requireRole('admin')` e `requireAccess('loja' | 'oficina')` nas server functions. Client lê `useSession()` via query.
- **Vendedor num registo**: cada `registos` guarda `utilizador_id` **ou** `vendedor_id` (um dos dois). Endpoint de criação de venda valida o PIN se `vendedor_id` for usado.
- **Schema completo** (Loja + Oficina), com RLS `USING (true)` em SELECT/INSERT/UPDATE apenas para `authenticated` — a autorização real acontece em server functions com sessão custom (`service_role` no servidor, RLS não pode saber quem é o "utilizador" da app custom). Justificação: como não usamos Supabase Auth, não há `auth.uid()` para políticas. A app fala com a base sempre via server functions com autorização em código.
- **Chaves**: `SESSION_SECRET` gerada via `generate_secret`. Sem `SUPABASE_SERVICE_ROLE_KEY` extra — usa-se o cliente admin já disponível no template.
- **Estilo**: tema escuro por defeito, `--primary` âmbar/laranja quente (loja/oficina), tipografia Inter + JetBrains Mono para números/tabelas, tabelas densas, atalhos de teclado nas listas de venda.
- **UI PT-PT**: todos os labels, mensagens e formatos (data `dd/mm/aaaa`, moeda `€`, decimal `,`).

## Ordem de trabalhos

1. Ativar Lovable Cloud.
2. Migração única com todo o schema (Loja + Oficina) + grants + RLS.
3. Design system PT/tema âmbar em `src/styles.css`.
4. Auth custom (server functions, middleware, hook `useCurrentUser`, `/login`).
5. Shell (sidebar + layout `_app`) e guards por permissão.
6. Sistema: Utilizadores, Vendedores (admin only).
7. Catálogo e Clientes.
8. Caixa (abertura, saídas, fecho) e Nova Venda.
9. Registos, Conta-corrente, Relatórios + CSV.
10. Seed do admin inicial e verificação end-to-end.

Confirmo e avanço?
