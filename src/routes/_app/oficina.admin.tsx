import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOSAntesDe, purgarOSAntesDe, getOS } from "@/lib/oficina.functions";
import { getCompany } from "@/lib/admin.functions";
import { generatePdfOS, type OSParaPdf } from "@/lib/generatePdfOS";
import { Route as AppRoute } from "@/routes/_app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Archive } from "lucide-react";

export const Route = createFileRoute("/_app/oficina/admin")({
  head: () => ({ meta: [{ title: "Administração da Oficina — VRCF" }] }),
  beforeLoad: ({ context }) => {
    if (context.currentUser.papel !== "admin") {
      throw redirect({ to: "/oficina" });
    }
  },
  component: AdminOficinaPage,
});

function AdminOficinaPage() {
  const [dataLimite, setDataLimite] = useState("");
  const [aProcessar, setAProcessar] = useState(false);
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => getCompany() });

  const { data: antigas = [] } = useQuery({
    queryKey: ["os-antigas", dataLimite],
    queryFn: () => (dataLimite ? listOSAntesDe({ data: { data_limite: new Date(dataLimite).toISOString() } }) : Promise.resolve([])),
    enabled: !!dataLimite,
  });

  const purgar = useServerFn(purgarOSAntesDe);

  const purgarM = useMutation({
    mutationFn: async () => {
      setAProcessar(true);
      try {
        // Gera o PDF Full de cada OS antiga (arquivo) antes de apagar — igual ao original.
        for (const o of antigas) {
          const completa = await getOS({ data: { id: o.id } });
          await generatePdfOS(
            completa.os as unknown as OSParaPdf,
            completa.itens,
            completa.anexos,
            empresa ?? {},
            "full",
          );
        }
        await purgar({ data: { data_limite: new Date(dataLimite).toISOString() } });
      } finally {
        setAProcessar(false);
      }
    },
  });

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/oficina">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Administração da Oficina</h1>
          <p className="text-sm text-muted-foreground">Arquivar e apagar ordens de serviço antigas.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4" /> Arquivar e apagar ordens antigas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gera o PDF Full de cada ordem anterior à data selecionada (fica no teu computador) e só depois
            apaga-as da base de dados.
          </p>
          <div className="space-y-2 max-w-xs">
            <Label>Apagar ordens anteriores a</Label>
            <Input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
          </div>
          {dataLimite && (
            <p className="text-xs text-muted-foreground">{antigas.length} ordem(ns) serão afetadas.</p>
          )}
          {purgarM.isError && (
            <p className="text-sm text-destructive">{(purgarM.error as Error).message}</p>
          )}
          <Button
            variant="destructive"
            disabled={!dataLimite || antigas.length === 0 || aProcessar}
            onClick={() => {
              if (window.confirm(`Vai gerar o PDF Full de ${antigas.length} ordem(ns) e depois apagá-las. Continuar?`)) {
                purgarM.mutate();
              }
            }}
          >
            {aProcessar ? "A processar…" : "Gerar PDFs e apagar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
