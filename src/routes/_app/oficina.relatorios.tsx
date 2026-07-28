import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { relatorioOficina, STATUS_LABELS, type StatusOS } from "@/lib/oficina.functions";
import { eur, d } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/oficina/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios da Oficina — VRCF" }] }),
  component: RelatoriosOficinaPage,
});

function primeiroDiaDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function RelatoriosOficinaPage() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hoje());

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-oficina", inicio, fim],
    queryFn: () => relatorioOficina({ data: { inicio, fim } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/oficina">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Relatórios da Oficina</h1>
          <p className="text-sm text-muted-foreground">Ordens de serviço recebidas no período.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Ordens recebidas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data.total_os}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Faturado (entregues)</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{eur(data.total_faturado)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">Tempo médio até entrega</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {data.tempo_medio_dias !== null ? `${data.tempo_medio_dias} dias` : "—"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por estado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              {Object.entries(data.por_estado).map(([status, n]) => (
                <div key={status} className="flex items-center justify-between border-b border-border/50 pb-1">
                  <span>{STATUS_LABELS[status as StatusOS] ?? status}</span>
                  <span className="font-medium">{n}</span>
                </div>
              ))}
              {Object.keys(data.por_estado).length === 0 && (
                <p className="text-muted-foreground col-span-3">Sem ordens de serviço no período.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ordens no período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {data.ordens.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                  <Link to="/oficina/$id" params={{ id: o.id }} className="hover:underline">
                    #{o.numero} — {o.cliente_nome ?? "—"}
                  </Link>
                  <span className="text-muted-foreground">{d(o.data_rececao)}</span>
                  <span>{STATUS_LABELS[o.status as StatusOS] ?? o.status}</span>
                </div>
              ))}
              {data.ordens.length === 0 && <p className="text-muted-foreground">Sem ordens de serviço.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
