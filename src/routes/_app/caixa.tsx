import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  abrirCaixa,
  adicionarSaida,
  caixaAberto,
  fecharCaixa,
  getCaixaDetalhe,
  listCaixa,
  reabrirCaixa,
  removerSaida,
} from "@/lib/loja.functions";
import { useVendedorObrigatorio } from "@/components/IdentificarVendedor";
import { Route as AppRoute } from "@/routes/_app";
import { eur, dt, d as dOnly } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — VRCF" },
      { name: "description", content: "Abertura, saídas e fecho do caixa diário." },
    ],
  }),
  component: CaixaPage,
});

function CaixaPage() {
  const qc = useQueryClient();
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
  const { vendedorId, vendedorNome, vendedorPin, trocarVendedor, dialog, pronto } = useVendedorObrigatorio();
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const { data: atual, isLoading } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: () => caixaAberto(),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["caixa-hist"],
    queryFn: () => listCaixa(),
  });

  const reabrir = useServerFn(reabrirCaixa);
  const reabrirM = useMutation({
    mutationFn: (vars: { id: string; motivo: string }) => reabrir({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
      qc.invalidateQueries({ queryKey: ["caixa-hist"] });
    },
  });

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caixa</h1>
          <p className="text-sm text-muted-foreground">Gestão diária do fundo de caixa.</p>
        </div>
        {pronto && (
          <div className="text-sm text-muted-foreground">
            Vendedor: <span className="font-medium text-foreground">{vendedorNome}</span>{" "}
            <Button size="sm" variant="ghost" onClick={trocarVendedor}>Trocar</Button>
          </div>
        )}
      </div>
      {!pronto ? null : isLoading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : atual ? (
        <CaixaAberto
          caixa={atual.caixa}
          saidas={atual.saidas}
          totais={atual.totais}
          vendedorId={vendedorId!}
          vendedorPin={vendedorPin!}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
            qc.invalidateQueries({ queryKey: ["caixa-hist"] });
          }}
        />
      ) : (
        <AbrirCaixaForm
          vendedorId={vendedorId!}
          vendedorPin={vendedorPin!}
          onOpened={() => qc.invalidateQueries({ queryKey: ["caixa-aberto"] })}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Final contado</TableHead>
                <TableHead>Aberto</TableHead>
                <TableHead>Fechado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16" />
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {dOnly(c.data)}
                    {c.reaberta && <span className="text-xs text-muted-foreground ml-1">(reaberta)</span>}
                  </TableCell>
                  <TableCell className="text-right mono">{eur(c.saldo_inicial)}</TableCell>
                  <TableCell className="text-right mono">
                    {c.saldo_final != null ? eur(c.saldo_final) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dt(c.aberto_em)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.fechado_em ? dt(c.fechado_em) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.estado === "fechado" ? <Badge variant="outline">Fechado</Badge> : <Badge>Aberto</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setDetalheId(c.id)}>
                      Ver
                    </Button>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {c.estado === "fechado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const motivo = window.prompt("Motivo da reabertura (obrigatório):");
                            if (motivo && motivo.trim().length >= 3) reabrirM.mutate({ id: c.id, motivo });
                          }}
                        >
                          Reabrir
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {detalheId && <FechoDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />}
    </div>
  );
}

function FechoDetalheDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["caixa-detalhe", id],
    queryFn: () => getCaixaDetalhe({ data: { id } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl print:max-w-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Fecho de caixa {data ? `— ${dOnly(data.caixa.data)}` : ""}</DialogTitle>
        </DialogHeader>
        {!data ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>Data: <strong>{dOnly(data.caixa.data)}</strong></div>
              <div>Estado: <strong className="capitalize">{data.caixa.estado}</strong></div>
              <div>Aberto por: {(data.caixa.abertura as { nome?: string } | null)?.nome ?? "—"}</div>
              <div>Fechado por: {(data.caixa.fecho as { nome?: string } | null)?.nome ?? "—"}</div>
              <div>Saldo inicial: {eur(data.caixa.saldo_inicial)}</div>
              <div>Saldo final contado: {data.caixa.saldo_final != null ? eur(data.caixa.saldo_final) : "—"}</div>
              <div>Saldo esperado: {eur(data.totais.saldoEsperado)}</div>
              <div>Nº fechos: {data.caixa.num_fechos}</div>
            </div>
            {data.caixa.reaberta && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs">
                Reaberta por {(data.caixa.reabertura as { nome?: string } | null)?.nome ?? "—"}
                {data.caixa.reaberta_motivo ? ` — ${data.caixa.reaberta_motivo}` : ""}
              </div>
            )}

            <div>
              <p className="font-medium mb-1">Vendas do dia ({data.registos.filter((r) => !r.anulado).length})</p>
              <div className="space-y-1 max-h-40 overflow-auto">
                {data.registos.map((r) => (
                  <div key={r.id} className={`flex justify-between ${r.anulado ? "opacity-50" : ""}`}>
                    <span>
                      #{r.numero} — {(r.cliente as { nome?: string } | null)?.nome ?? "Consumidor final"}
                      {r.anulado && " (anulado)"}
                    </span>
                    <span className="mono">{eur(r.total)}</span>
                  </div>
                ))}
                {data.registos.length === 0 && <p className="text-muted-foreground">Sem vendas.</p>}
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">Saídas</p>
              <div className="space-y-1">
                {data.saidas.map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span className="capitalize">{s.tipo}: {s.descricao}</span>
                    <span className="mono">{eur(s.valor)}</span>
                  </div>
                ))}
                {data.saidas.length === 0 && <p className="text-muted-foreground">Sem saídas.</p>}
              </div>
            </div>

            <div className="print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Imprimir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AbrirCaixaForm({
  vendedorId,
  vendedorPin,
  onOpened,
}: {
  vendedorId: string;
  vendedorPin: string;
  onOpened: () => void;
}) {
  const fn = useServerFn(abrirCaixa);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const m = useMutation({
    mutationFn: () => fn({ data: { valor_inicial: valor, data, vendedor_id: vendedorId, vendedor_pin: vendedorPin } }),
    onSuccess: onOpened,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir caixa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor inicial (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={valor}
              onChange={(e) => setValor(Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? "A abrir…" : "Abrir caixa"}
        </Button>
        {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
      </CardContent>
    </Card>
  );
}

type Saida = { id: string; descricao: string; tipo: string; valor: number; criado_em: string };
type Totais = {
  dinheiro: number;
  mb: number;
  transferencia: number;
  cheque: number;
  outro: number;
  conta_corrente: number;
  numPagamentos: number;
  sangrias: number;
  despesas: number;
  liquidacoes: number;
  saldoEsperado: number;
};

function CaixaAberto({
  caixa,
  saidas,
  totais,
  vendedorId,
  vendedorPin,
  onChanged,
}: {
  caixa: { id: string; data: string; saldo_inicial: number; num_fechos: number };
  saidas: Saida[];
  totais: Totais;
  vendedorId: string;
  vendedorPin: string;
  onChanged: () => void;
}) {
  const addFn = useServerFn(adicionarSaida);
  const rmFn = useServerFn(removerSaida);
  const closeFn = useServerFn(fecharCaixa);
  const { currentUser } = AppRoute.useRouteContext();

  const [tipo, setTipo] = useState<"sangria" | "despesa">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [contado, setContado] = useState(0);
  const [obs, setObs] = useState("");

  const addM = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          caixa_id: caixa.id,
          tipo,
          descricao,
          valor,
          vendedor_id: vendedorId,
          vendedor_pin: vendedorPin,
        },
      }),
    onSuccess: () => {
      setDescricao("");
      setValor(0);
      onChanged();
    },
  });
  const rmM = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: onChanged,
  });
  const closeM = useMutation({
    mutationFn: () =>
      closeFn({
        data: {
          id: caixa.id,
          valor_final_contado: contado,
          observacoes: obs || null,
          vendedor_id: vendedorId,
          vendedor_pin: vendedorPin,
        },
      }),
    onSuccess: onChanged,
  });

  const diferenca = contado - totais.saldoEsperado;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Caixa aberto — {dOnly(caixa.data)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase">Inicial</div>
              <div className="text-lg mono">{eur(caixa.saldo_inicial)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase">Dinheiro</div>
              <div className="text-lg mono">{eur(totais.dinheiro)}</div>
              {totais.liquidacoes > 0 && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  inclui {eur(totais.liquidacoes)} de liquidações
                </div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase">Saldo esperado</div>
              <div className="text-lg mono font-semibold">{eur(totais.saldoEsperado)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div>MB: {eur(totais.mb)}</div>
            <div>Transferência: {eur(totais.transferencia)}</div>
            <div>Sangrias: {eur(totais.sangrias)}</div>
            <div>Despesas: {eur(totais.despesas)}</div>
            <div>{totais.numPagamentos} pagamento(s)</div>
          </div>
          {totais.conta_corrente > 0 && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100">
              Vendas a crédito hoje: <strong>{eur(totais.conta_corrente)}</strong> — não entram na
              caixa até serem liquidadas.
            </div>
          )}
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saidas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                      Sem saídas.
                    </TableCell>
                  </TableRow>
                ) : (
                  saidas.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="capitalize text-xs">{s.tipo}</TableCell>
                      <TableCell>{s.descricao}</TableCell>
                      <TableCell className="text-right mono">{eur(s.valor)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => rmM.mutate(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-[140px_1fr_120px] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "sangria" | "despesa")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="sangria">Sangria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (€)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={valor}
                  onChange={(e) => setValor(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={() => addM.mutate()}
              disabled={addM.isPending || !descricao.trim() || valor <= 0}
            >
              Registar saída
            </Button>
            {addM.error && <div className="text-sm text-destructive">{(addM.error as Error).message}</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fecho de caixa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {caixa.num_fechos >= 1 && currentUser.papel !== "admin" && (
            <p className="text-sm text-amber-600">
              Este dia já foi fechado. Só o administrador pode retificar o fecho.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Valor final contado (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={contado}
              onChange={(e) => setContado(Number(e.target.value))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Esperado: {eur(totais.saldoEsperado)} · Diferença: {" "}
            <span className={diferenca === 0 ? "" : diferenca > 0 ? "text-emerald-600" : "text-destructive"}>
              {eur(diferenca)}
            </span>
          </p>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          {closeM.error && <div className="text-sm text-destructive">{(closeM.error as Error).message}</div>}
          <Button
            variant="destructive"
            onClick={() => closeM.mutate()}
            disabled={closeM.isPending || (caixa.num_fechos >= 1 && currentUser.papel !== "admin")}
          >
            {closeM.isPending ? "A fechar…" : "Fechar caixa"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
