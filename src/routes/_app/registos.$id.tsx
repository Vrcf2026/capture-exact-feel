import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { anularRegisto, atualizarRegisto, getRegisto, marcarFaturado, reativarRegisto } from "@/lib/loja.functions";
import { Route as AppRoute } from "@/routes/_app";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Trash2, Plus } from "lucide-react";

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
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
  const { data } = useQuery({
    queryKey: ["registo", id],
    queryFn: () => getRegisto({ data: { id } }),
  });

  const fatFn = useServerFn(marcarFaturado);
  const anuFn = useServerFn(anularRegisto);
  const reatFn = useServerFn(reativarRegisto);
  const fatM = useMutation({
    mutationFn: (v: boolean) => fatFn({ data: { id, faturado: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registo", id] }),
  });
  const [motivo, setMotivo] = useState("");
  const anuM = useMutation({
    mutationFn: () => anuFn({ data: { id, motivo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registo", id] }),
  });
  const reatM = useMutation({
    mutationFn: () => reatFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registo", id] }),
  });
  const [editando, setEditando] = useState(false);

  if (!data?.registo) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  const r = data.registo as {
    id: string; numero: number; data: string; total: number; notas: string | null;
    faturado: boolean; anulado: boolean; anulado_motivo: string | null;
    cliente: { id?: string; nome?: string; nif?: string | null } | null;
    utilizador: { nome?: string } | null; vendedor: { nome?: string } | null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/registos" className="text-xs text-muted-foreground inline-flex items-center hover:text-foreground print:hidden">
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Registo #{r.numero}</h1>
          <p className="text-sm text-muted-foreground">{dt(r.data)}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Imprimir
          </Button>
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
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Itens</CardTitle>
              {isAdmin && !r.anulado && (
                <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                  Editar
                </Button>
              )}
            </CardHeader>
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
                      <TableCell className="capitalize">
                        {String(p.metodo).replace(/_/g, " ")}
                        {p.notas && (
                          <span className="mt-0.5 block text-xs normal-case text-muted-foreground">
                            {p.notas}
                          </span>
                        )}
                      </TableCell>
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
          {r.anulado && isAdmin && (
            <Button variant="outline" onClick={() => reatM.mutate()} disabled={reatM.isPending}>
              Reativar registo
            </Button>
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
            <div className="space-y-2 print:hidden">
              <Button
                className="w-full"
                variant={r.faturado ? "outline" : "default"}
                onClick={() => fatM.mutate(!r.faturado)}
                disabled={fatM.isPending}
              >
                {r.faturado ? "Marcar como não faturado" : "Marcar como faturado"}
              </Button>
              {isAdmin && (
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
              )}
            </div>
          )}
        </div>
      </div>
      {editando && data && (
        <EditarItensDialog
          registoId={id}
          clienteId={r.cliente?.id ?? null}
          notas={r.notas}
          itensIniciais={data.itens}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false);
            qc.invalidateQueries({ queryKey: ["registo", id] });
          }}
        />
      )}
      <div className="hidden print:block mt-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        Documento interno — sem valor fiscal
      </div>
      <style>{`
        @media print {
          header, nav, aside { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
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

type ItemEdit = { descricao: string; quantidade: number; preco_unitario: number; catalogo_id: string | null };

function EditarItensDialog({
  registoId,
  clienteId,
  notas,
  itensIniciais,
  onClose,
  onSaved,
}: {
  registoId: string;
  clienteId: string | null;
  notas: string | null;
  itensIniciais: { descricao: string; quantidade: number; preco_unitario: number; catalogo_id: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itens, setItens] = useState<ItemEdit[]>(
    itensIniciais.map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      preco_unitario: Number(i.preco_unitario),
      catalogo_id: i.catalogo_id,
    })),
  );
  const [notasState, setNotasState] = useState(notas ?? "");

  const save = useServerFn(atualizarRegisto);
  const m = useMutation({
    mutationFn: () =>
      save({
        data: { id: registoId, cliente_id: clienteId, notas: notasState || null, itens },
      }),
    onSuccess: onSaved,
  });

  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  function upd(i: number, campo: keyof ItemEdit, valor: string) {
    setItens((prev) =>
      prev.map((it, idx) =>
        idx === i
          ? { ...it, [campo]: campo === "descricao" ? valor : Number(valor) }
          : it,
      ),
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar registo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            A edição fica registada (data e utilizador) — usa só para corrigir erros.
          </p>
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_90px_32px] gap-2 items-center">
              <Input value={it.descricao} onChange={(e) => upd(i, "descricao", e.target.value)} />
              <Input
                type="number" step="1" min="0"
                value={it.quantidade}
                onChange={(e) => upd(i, "quantidade", e.target.value)}
              />
              <Input
                type="number" step="0.01" min="0"
                value={it.preco_unitario}
                onChange={(e) => upd(i, "preco_unitario", e.target.value)}
              />
              <Button
                size="icon" variant="ghost"
                onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={itens.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            size="sm" variant="outline"
            onClick={() => setItens((prev) => [...prev, { descricao: "", quantidade: 1, preco_unitario: 0, catalogo_id: null }])}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar item
          </Button>
          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={notasState} onChange={(e) => setNotasState(e.target.value)} />
          </div>
          <div className="flex justify-end text-sm font-medium">Novo total: {eur(total)}</div>
          {m.error && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || itens.some((i) => !i.descricao.trim() || i.quantidade <= 0)}
          >
            {m.isPending ? "A guardar…" : "Guardar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
