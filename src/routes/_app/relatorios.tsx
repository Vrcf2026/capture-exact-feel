import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { relatorio } from "@/lib/loja.functions";
import { eur, dt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — VRCF" },
      { name: "description", content: "Vendas, pagamentos e saídas por período." },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (context.currentUser.papel !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const hoje = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoje);
  const [ate, setAte] = useState(hoje);

  const range = useMemo(
    () => ({
      desde: new Date(desde).toISOString(),
      ate: new Date(new Date(ate).setHours(23, 59, 59, 999)).toISOString(),
    }),
    [desde, ate],
  );

  const { data } = useQuery({
    queryKey: ["relatorio", range],
    queryFn: () => relatorio({ data: range }),
  });

  const totalVendas = data?.vendas.reduce((s, v) => s + Number(v.total), 0) ?? 0;
  const totalSaidas = data?.saidas.reduce((s, v) => s + Number(v.valor), 0) ?? 0;
  const porMetodo = (data?.pagamentos ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.metodo] = (acc[p.metodo] ?? 0) + Number(p.valor);
    return acc;
  }, {});

  function exportarCSV() {
    if (!data) return;
    const linhas = [
      ["numero", "data", "total"].join(";"),
      ...data.vendas.map((v) => [v.numero, dt(v.data), Number(v.total).toFixed(2).replace(".", ",")].join(";")),
    ];
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas_${desde}_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise por intervalo de datas.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto] items-end rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button variant="outline" onClick={exportarCSV} disabled={!data}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric title="Vendas" value={eur(totalVendas)} subtitle={`${data?.vendas.length ?? 0} registos`} />
        <Metric title="Saídas de caixa" value={eur(totalSaidas)} />
        <Metric title="Dinheiro" value={eur(porMetodo.dinheiro ?? 0)} />
        <Metric title="Multibanco" value={eur(porMetodo.mb ?? 0)} />
        <Metric title="Transferência" value={eur(porMetodo.transferencia ?? 0)} />
        <Metric title="Conta-corrente" value={eur(porMetodo.conta_corrente ?? 0)} />
        <Metric title="Cheque" value={eur(porMetodo.cheque ?? 0)} />
        <Metric title="Outro" value={eur(porMetodo.outro ?? 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caixa por dia</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2 text-right">Saldo inicial</th>
                <th className="px-4 py-2 text-right">Saldo final</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data?.caixas ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Sem caixas no período.
                  </td>
                </tr>
              ) : (
                (data?.caixas ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="px-4 py-2">{dt(c.data)}</td>
                    <td className="px-4 py-2 text-right mono">{eur(c.saldo_inicial)}</td>
                    <td className="px-4 py-2 text-right mono">
                      {c.saldo_final != null ? eur(c.saldo_final) : "—"}
                    </td>
                    <td className="px-4 py-2 capitalize">{c.estado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold mono">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
