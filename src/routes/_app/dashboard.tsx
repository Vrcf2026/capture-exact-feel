import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { resumoHoje } from "@/lib/loja.functions";
import { resumoOficinaHoje } from "@/lib/geral.functions";
import { useQuery } from "@tanstack/react-query";
import { eur } from "@/lib/format";
import { STATUS_LABELS, type StatusOS } from "@/lib/oficina.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

function hojeRange() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return { desde: inicio.toISOString(), ate: fim.toISOString() };
}

const dashQuery = queryOptions({
  queryKey: ["dashboard-hoje"],
  queryFn: () => resumoHoje(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — VRCF" },
      { name: "description", content: "Resumo de vendas, caixa e atividade da VRCF." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel</h1>
        <p className="text-sm text-muted-foreground">Resumo de hoje.</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">A carregar…</div>}>
        <Cards />
      </Suspense>
      <div>
        <h2 className="text-lg font-semibold">Oficina</h2>
        <p className="text-sm text-muted-foreground">Ordens de serviço.</p>
      </div>
      <CardsOficina />
    </div>
  );
}

function Cards() {
  const { data } = useSuspenseQuery(dashQuery);
  const totalVendas = data.vendas.reduce((s, v) => s + Number(v.total), 0);
  const totalSaidas = data.saidas.reduce((s, v) => s + Number(v.valor), 0);
  const porMetodo = data.pagamentos.reduce<Record<string, number>>((acc, p) => {
    acc[p.metodo] = (acc[p.metodo] ?? 0) + Number(p.valor);
    return acc;
  }, {});
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Metric title="Vendas hoje" value={eur(totalVendas)} subtitle={`${data.vendas.length} registos`} />
      <Metric title="Saídas de caixa" value={eur(totalSaidas)} subtitle={`${data.saidas.length} lançamentos`} />
      <Metric title="Dinheiro recebido" value={eur(porMetodo.dinheiro ?? 0)} />
      <Metric title="Multibanco" value={eur(porMetodo.mb ?? 0)} />
    </div>
  );
}

function CardsOficina() {
  const { data } = useQuery({
    queryKey: ["dashboard-oficina"],
    queryFn: () => resumoOficinaHoje(),
    staleTime: 30_000,
  });
  if (!data) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  const emCurso = Object.entries(data.porEstado)
    .filter(([k]) => k !== "entregue")
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric title="OS abertas" value={String(data.abertas)} subtitle={`${data.total} no total`} />
        <Metric title="Recebidas hoje" value={String(data.recebidasHoje)} />
        <Metric title="Entregues hoje" value={String(data.entreguesHoje)} />
        <Metric title="Faturado oficina (hoje)" value={eur(data.faturadoHoje)} />
      </div>
      {emCurso.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por estado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {emCurso.map(([estado, n]) => (
              <span key={estado} className="rounded-md border border-border px-2 py-1 text-xs">
                {STATUS_LABELS[estado as StatusOS] ?? estado}: <b className="mono">{n}</b>
              </span>
            ))}
          </CardContent>
        </Card>
      )}
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
