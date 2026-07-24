import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { anularRegisto, getRegisto, marcarFaturado } from "@/lib/loja.functions";
import { eur, dt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/registos/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Registo — VRCF` },
      { name: "description", content: `Detalhe do registo ${params.id}.` },
    ],
  }),
  component: RegistoPage,
});

function RegistoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["registo", id],
    queryFn: () => getRegisto({ data: { id } }),
  });

  const fatFn = useServerFn(marcarFaturado);
  const anuFn = useServerFn(anularRegisto);
  const fatM = useMutation({
    mutationFn: (v: boolean) => fatFn({ data: { id, faturado: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registo", id] }),
  });
  const [motivo, setMotivo] = useState("");
  const anuM = useMutation({
    mutationFn: () => anuFn({ data: { id, motivo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registo", id] }),
  });

  if (!data?.registo) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  const r = data.registo as {
    id: string; numero: number; data: string; total: number; notas: string | null;
    faturado: boolean; anulado: boolean; anulado_motivo: string | null;
    cliente: { nome?: string; nif?: string | null } | null;
    utilizador: { nome?: string } | null; vendedor: { nome?: string } | null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/registos" className="text-xs text-muted-foreground inline-flex items-center hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Registo #{r.numero}</h1>
          <p className="text-sm text-muted-foreground">{dt(r.data)}</p>
        </div>
        <div className="flex items-center gap-2">
          {r.anulado ? (
            <Badge variant="destructive">Anulado</Badge>
          ) : r.faturado ? (
            <Badge>Faturado</Badge>
          ) : (
            <Badge variant="outline">Emitido</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Itens</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-24">Qtd.</TableHead>
                    <TableHead className="text-right w-28">Preço</TableHead>
                    <TableHead className="text-right w-28">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell className="text-right mono">{Number(i.quantidade)}</TableCell>
                      <TableCell className="text-right mono">{eur(i.preco_unitario)}</TableCell>
                      <TableCell className="text-right mono">
                        {eur(Number(i.quantidade) * Number(i.preco_unitario))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pagamentos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Liquidado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pagamentos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="capitalize">{String(p.metodo).replace("_", " ")}</TableCell>
                      <TableCell className="text-right mono">{eur(p.valor)}</TableCell>
                      <TableCell>
                        {p.liquidado ? <Badge variant="outline">Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {r.notas && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{r.notas}</CardContent>
            </Card>
          )}
          {r.anulado && r.anulado_motivo && (
            <Card>
              <CardHeader><CardTitle className="text-base text-destructive">Motivo de anulação</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{r.anulado_motivo}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Line label="Cliente" value={r.cliente?.nome ?? "Consumidor final"} />
              {r.cliente?.nif && <Line label="NIF" value={r.cliente.nif} />}
              <Line label="Vendedor" value={r.vendedor?.nome ?? r.utilizador?.nome ?? "—"} />
              <div className="border-t border-border my-2" />
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground">Total</div>
                <div className="mono text-xl font-semibold">{eur(r.total)}</div>
              </div>
            </CardContent>
          </Card>

          {!r.anulado && (
            <div className="space-y-2">
              <Button
                className="w-full"
                variant={r.faturado ? "outline" : "default"}
                onClick={() => fatM.mutate(!r.faturado)}
                disabled={fatM.isPending}
              >
                {r.faturado ? "Marcar como não faturado" : "Marcar como faturado"}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">Anular</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Anular registo</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Indica o motivo. O registo é marcado como anulado (não é apagado).
                    </p>
                    <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    {anuM.error && <div className="text-sm text-destructive">{(anuM.error as Error).message}</div>}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => anuM.mutate()}
                      disabled={anuM.isPending || motivo.trim().length < 3}
                    >
                      Anular
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}
