# Limpar warnings de `.inputValidator()` → `.validator()`

## Contexto

O TanStack Start descontinuou o método `.inputValidator()` em favor de `.validator()`.
Ambos funcionam, mas o método antigo gera warnings no dev server. São 44 ocorrências
em 6 ficheiros.

## Ficheiros afetados (44 ocorrências no total)

- `src/lib/loja.functions.ts` — 15
- `src/lib/oficina.functions.ts` — 14
- `src/lib/admin.functions.ts` — 8
- `src/lib/stock.functions.ts` — 3
- `src/lib/auth.functions.ts` — 2
- `src/lib/geral.functions.ts` — 2

## Plano

1. Substituir `.inputValidator(` por `.validator(` em todos os 6 ficheiros (find-and-replace literal).
2. Confirmar que o typecheck passa sem erros.
3. Confirmar que os warnings desapareceram dos logs do dev server.

## Nota

Não há alteração de comportamento — é apenas um renomear de API. O `.validator()`
faz exatamente o mesmo que `.inputValidator()`. Zero risco funcional.
