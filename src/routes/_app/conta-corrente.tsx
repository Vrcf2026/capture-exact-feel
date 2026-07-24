import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { liquidarPagamento, listContaCorrente } from "@/lib/loja.functions";
import { eur, dt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/conta-corrente")({
  head: () => ({
    meta: [
      { title: "Conta-corrente — VRCF" },
      { name: "description", content: "Pagamentos em aberto a receber de clientes." },
    ],
  }),
  component: ContaCorrentePage,
});

type Row = {
  id: string; valor: number; data: string; liquidado: boolean; liquidado_em: string | null;
  registo: {
    id: string; numero: number; data: string; anulado: boolean;
    cliente: { id: string; nome: string; nif: string | null; telefone: string | null } | null;
  } | null;
};

function ContaCorrentePage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["cc"],
    queryFn: () => listContaCorrente() as unknown as Promise<Row[]>,
  });

  const liq = useServerFn(liquidarPagamento);
  const m = useMutation({
    mutationFn: (id: string) => liq({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc"] }),
  });

  const activos = data.filter((r) => !r.registo?.anulado);
  const emAberto = activos.filter((r) => !r.liquidado);
  const totalAberto = emAberto.reduce((s, r) => s + Number(r.valor), 0);

  const porCliente = new Map<string, { nome: string; total: number; itens: Row[] }>();
  for (const r of emAberto) {
    const cli = r.registo?.cliente;
    if (!cli) continue;
    const key = cli.id;
    if (!porCliente.has(key)) porCliente.set(key, { nome: cli.nome, total: 0, itens: [] });
    const bucket = porCliente.get(key)!;
    bucket.total += Number(r.valor);
    bucket.itens.push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conta-corrente</h1>
          <p className="text-sm text-muted-foreground">Pagamentos em conta-corrente por liquidar.</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Total em aberto</div>
          <div className="mono text-2xl font-semibold">{eur(totalAberto)}</div>
        </div>
      </div>

      {porCliente.size === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Sem pagamentos em aberto.
          </CardContent>
        </Card>
      ) : (
        [...porCliente.entries()].map(([id, bucket]) => (
          <Card key={id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{bucket.nome}</CardTitle>
              <div className="mono font-semibold">{eur(bucket.total)}</div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bucket.itens.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="mono">
                        {r.registo && (
                          <Link to="/registos/$id" params={{ id: r.registo.id }} className="text-primary hover:underline">
                            #{r.registo.numero}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dt(r.data)}</TableCell>
                      <TableCell className="text-right mono">{eur(r.valor)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => m.mutate(r.id)}
                          disabled={m.isPending}
                        >
                          Liquidar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recentemente liquidados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Registo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Liquidado em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activos.filter((r) => r.liquidado).slice(0, 20).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.registo?.cliente?.nome ?? "—"}</TableCell>
                  <TableCell className="mono">
                    {r.registo && (
                      <Link to="/registos/$id" params={{ id: r.registo.id }} className="text-primary hover:underline">
                        #{r.registo.numero}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right mono">{eur(r.valor)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.liquidado_em ? dt(r.liquidado_em) : "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline">Liquidado</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
