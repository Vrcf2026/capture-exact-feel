import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  abrirCaixa,
  adicionarSaida,
  caixaAberto,
  fecharCaixa,
  listCaixa,
  removerSaida,
} from "@/lib/loja.functions";
import { eur, dt, d as dOnly } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { data: atual, isLoading } = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: () => caixaAberto(),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["caixa-hist"],
    queryFn: () => listCaixa(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Caixa</h1>
        <p className="text-sm text-muted-foreground">Gestão diária do fundo de caixa.</p>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : atual ? (
        <CaixaAberto
          caixa={atual.caixa}
          saidas={atual.saidas}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
            qc.invalidateQueries({ queryKey: ["caixa-hist"] });
          }}
        />
      ) : (
        <AbrirCaixaForm onOpened={() => qc.invalidateQueries({ queryKey: ["caixa-aberto"] })} />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{dOnly(c.data)}</TableCell>
                  <TableCell className="text-right mono">{eur(c.valor_inicial)}</TableCell>
                  <TableCell className="text-right mono">
                    {c.valor_final_contado != null ? eur(c.valor_final_contado) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dt(c.aberto_em)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.fechado_em ? dt(c.fechado_em) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.fechado_em ? <Badge variant="outline">Fechado</Badge> : <Badge>Aberto</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AbrirCaixaForm({ onOpened }: { onOpened: () => void }) {
  const fn = useServerFn(abrirCaixa);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const m = useMutation({
    mutationFn: () => fn({ data: { valor_inicial: valor, data } }),
    onSuccess: onOpened,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir caixa</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3 items-end">
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
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? "A abrir…" : "Abrir caixa"}
        </Button>
        {m.error && <div className="md:col-span-3 text-sm text-destructive">{(m.error as Error).message}</div>}
      </CardContent>
    </Card>
  );
}

type Saida = { id: string; motivo: string; valor: number; criado_em: string };

function CaixaAberto({
  caixa,
  saidas,
  onChanged,
}: {
  caixa: { id: string; data: string; valor_inicial: number };
  saidas: Saida[];
  onChanged: () => void;
}) {
  const addFn = useServerFn(adicionarSaida);
  const rmFn = useServerFn(removerSaida);
  const closeFn = useServerFn(fecharCaixa);

  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState(0);
  const [contado, setContado] = useState(0);
  const [obs, setObs] = useState("");

  const totalSaidas = saidas.reduce((s, x) => s + Number(x.valor), 0);

  const addM = useMutation({
    mutationFn: () => addFn({ data: { caixa_id: caixa.id, motivo, valor } }),
    onSuccess: () => {
      setMotivo(""); setValor(0);
      onChanged();
    },
  });
  const rmM = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: onChanged,
  });
  const closeM = useMutation({
    mutationFn: () =>
      closeFn({ data: { id: caixa.id, valor_final_contado: contado, observacoes: obs || null } }),
    onSuccess: onChanged,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Caixa aberto — {dOnly(caixa.data)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase">Inicial</div>
              <div className="text-lg mono">{eur(caixa.valor_inicial)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase">Saídas</div>
              <div className="text-lg mono">{eur(totalSaidas)}</div>
            </div>
          </div>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saidas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                      Sem saídas.
                    </TableCell>
                  </TableRow>
                ) : (
                  saidas.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.motivo}</TableCell>
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
          <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (€)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </div>
            <Button
              onClick={() => addM.mutate()}
              disabled={addM.isPending || !motivo.trim() || valor <= 0}
            >
              Registar saída
            </Button>
          </div>
          {addM.error && <div className="text-sm text-destructive">{(addM.error as Error).message}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fecho de caixa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Valor final contado (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={contado}
              onChange={(e) => setContado(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          {closeM.error && <div className="text-sm text-destructive">{(closeM.error as Error).message}</div>}
          <Button variant="destructive" onClick={() => closeM.mutate()} disabled={closeM.isPending}>
            {closeM.isPending ? "A fechar…" : "Fechar caixa"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
