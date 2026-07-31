import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fichaCliente } from "@/lib/geral.functions";
import { eur } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadgeOS } from "@/components/StatusBadgeOS";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha de cliente — VRCF" },
      { name: "description", content: "Histórico de compras e ordens de serviço do cliente." },
    ],
  }),
  component: FichaClientePage,
});

function dt(v: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-PT") : "—";
}

function FichaClientePage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ficha-cliente", id],
    queryFn: () => fichaCliente({ data: { id } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  if (error) return <div className="text-sm text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  const { cliente, registos, ordens, totalCompras, emDivida } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nome}</h1>
          <p className="text-sm text-muted-foreground">
            NIF {cliente.nif || "—"} · Tel. {cliente.telefone || "—"} · Linha de preço {cliente.linha_preco}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Total comprado" value={eur(totalCompras)} subtitle={`${registos.length} registos`} />
        <Metric title="Em dívida" value={eur(emDivida)} />
        <Metric title="Ordens de serviço" value={String(ordens.length)} />
        <Metric
          title="OS em curso"
          value={String(ordens.filter((o) => o.status !== "entregue").length)}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {registos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registadas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to="/registos/$id" params={{ id: r.id }} className="text-primary hover:underline mono">
                        #{r.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{dt(r.data)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.anulado ? "Anulado" : r.faturado ? "Faturado" : "—"}
                    </TableCell>
                    <TableCell className="text-right mono">{eur(Number(r.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ordens de serviço</CardTitle>
        </CardHeader>
        <CardContent>
          {ordens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem ordens de serviço.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Receção</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordens.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to="/oficina/$id" params={{ id: o.id }} className="text-primary hover:underline mono">
                        #{o.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[o.equipamento, o.marca_modelo].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>{dt(o.data_rececao)}</TableCell>
                    <TableCell>{dt(o.data_entrega)}</TableCell>
                    <TableCell>
                      <StatusBadgeOS status={o.status as never} />
                    </TableCell>
                    <TableCell className="text-right mono">
                      {o.valor_total_pago != null ? eur(Number(o.valor_total_pago)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold mono">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
