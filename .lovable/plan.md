# Backups do VRCF

Nova página **Backups** (só admin) para exportar todos os dados, mais um backup automático diário guardado no armazenamento.

## 1. Exportar tudo em JSON

- Botão "Descarregar backup completo (JSON)" que gera um ficheiro `vrcf-backup-AAAA-MM-DD.json`.
- Inclui todas as tabelas: clientes, catálogo, registos e itens, pagamentos, caixa diário, saídas de caixa, stock e movimentos, ordens de serviço e itens, vendedores, utilizadores (sem password), definições da empresa.
- Cabeçalho com data, versão e contagem de linhas por tabela, para se saber logo se o backup está completo.

## 2. Exportar CSV por tabela

- Lista de tabelas com o número de registos e um botão de download por tabela.
- Botão "Descarregar todos os CSV" que gera um ZIP com um CSV por tabela.
- CSV com separador `;` e BOM UTF-8 para abrir directamente no Excel em português (acentos correctos).

## 3. Backup automático diário

- Novo bucket privado `backups` no armazenamento.
- Todos os dias de madrugada é gerado e guardado o JSON completo em `backups/AAAA/MM/vrcf-backup-AAAA-MM-DD.json`.
- Na página Backups: lista dos backups automáticos existentes (data e tamanho) com download por link temporário.
- Retenção: mantém os últimos 30 dias e apaga os mais antigos automaticamente.
- Também dá para forçar "Gerar backup automático agora" para testar.

## 4. Cópia para o teu Google Drive

- Cada backup (diário automático e o manual) é também enviado para uma pasta no teu Google Drive, ex. `VRCF Backups`.
- Ligação da conta Google feita uma vez através do cartão de ligação do Google Drive no chat (sem colar chaves).
- Na página Backups: estado da ligação ao Drive, nome da pasta e último envio com sucesso; se o envio falhar, o backup fica sempre guardado no armazenamento interno e o erro é mostrado.


## 4. Acesso

- Entrada "Backups" na barra lateral visível apenas a admin.
- Todas as operações validam no servidor que a sessão é de um admin; um operador que tente acessar recebe erro.

## Notas técnicas

- Server functions em `src/lib/backup.functions.ts` (+ `backup.server.ts` para a leitura das tabelas via service role), seguindo o padrão de sessão própria já usado em `admin.functions.ts`.
- Página `src/routes/_app/backups.tsx`.
- ZIP gerado no cliente com `jszip` (única dependência nova); os CSV/JSON individuais não precisam de dependências.
- Agendamento com `pg_cron` + `pg_net` a chamar `src/routes/api/public/backup-diario.ts`, protegido por um segredo `BACKUP_CRON_SECRET` verificado no handler.
- O bucket `backups` fica privado com políticas deny-all (acesso só via service role e links temporários), igual ao `anexos`.
