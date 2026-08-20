import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { resumoHoje } from "@/lib/loja.functions";
import { resumoOficinaHoje, alertasPainel } from "@/lib/geral.functions";
import { useQuery } from "@tanstack/react-query";
import { eur } from "@/lib/format";
import { STATUS_LABELS, type StatusOS } from "@/lib/oficina.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Wallet, Wrench, CircleDollarSign } from "lucide-react";
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
  errorComponent: () => (
    <div className="space-y-3 p-2">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar o painel. Verifique a ligação e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md border border-border px-3 py-1.5 text-sm"
      >
        Recarregar
      </button>
    </div>
  ),
  component: Dashboard,

});

function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel</h1>
        <p className="text-sm text-muted-foreground">Resumo de hoje.</p>
      </div>
      <Alertas />
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

type Aviso = {
  key: string;
  tone: "warn" | "info";
  icon: React.ReactNode;
  texto: string;
  acao?: { to: string; label: string };
};

function Alertas() {
  const { data } = useQuery({
    queryKey: ["dashboard-alertas"],
    queryFn: () => alertasPainel(),
    staleTime: 30_000,
  });
  if (!data) return null;

  const avisos: Aviso[] = [];

  if (data.podeLoja && !data.caixaAbertaHoje) {
    avisos.push({
      key: "caixa",
      tone: "warn",
      icon: <Wallet className="size-4" />,
      texto: "A caixa de hoje ainda não está aberta — não é possível registar vendas.",
      acao: { to: "/caixa", label: "Abrir caixa" },
    });
  }
  if (data.podeLoja && data.caixaAnteriorAberta) {
    avisos.push({
      key: "caixa-anterior",
      tone: "warn",
      icon: <AlertTriangle className="size-4" />,
      texto: `Existe uma caixa de ${data.caixaAnteriorAberta.data} ainda aberta. Fecha-a para poder abrir o dia.`,
      acao: { to: "/caixa", label: "Ir para a caixa" },
    });
  }
  if (data.podeOficina && data.osProntas > 0) {
    avisos.push({
      key: "os-prontas",
      tone: "info",
      icon: <Wrench className="size-4" />,
      texto: `${data.osProntas} OS concluída(s) à espera de entrega ao cliente.`,
      acao: { to: "/oficina", label: "Ver OS" },
    });
  }
  if (data.podeOficina && data.osAguardaAprovacao > 0) {
    avisos.push({
      key: "os-orcamento",
      tone: "info",
      icon: <Wrench className="size-4" />,
      texto: `${data.osAguardaAprovacao} OS a aguardar aprovação de orçamento.`,
      acao: { to: "/oficina", label: "Ver OS" },
    });
  }
  if (data.podeOficina && data.osParadas > 0) {
    avisos.push({
      key: "os-paradas",
      tone: "warn",
      icon: <AlertTriangle className="size-4" />,
      texto: `${data.osParadas} OS sem movimento há mais de ${data.limiteDias} dias.`,
      acao: { to: "/oficina", label: "Ver OS" },
    });
  }
  if (data.podeLoja && data.dividaTotal > 0) {
    avisos.push({
      key: "dividas",
      tone: "warn",
      icon: <CircleDollarSign className="size-4" />,
      texto: `${eur(data.dividaTotal)} em dívida por liquidar (${data.dividaClientes} cliente(s)).`,
      acao: { to: "/conta-corrente", label: "Conta corrente" },
    });
  }

  if (avisos.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Info className="size-4" /> Sem alertas. Tudo em ordem.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {avisos.map((a) => (
        <div
          key={a.key}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
            a.tone === "warn"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted/40 text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            {a.icon}
            {a.texto}
          </span>
          {a.acao && (
            <Link
              to={a.acao.to}
              className="rounded-md border border-current px-2 py-1 text-xs font-medium hover:opacity-80"
            >
              {a.acao.label}
            </Link>
          )}
        </div>
      ))}
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
    <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
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
