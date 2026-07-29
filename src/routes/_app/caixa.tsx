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
  reabrirCaixa,
  removerSaida,
} from "@/lib/loja.functions";
import { listVendedores } from "@/lib/admin.functions";
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

function VendedorPin({
  vendedorId,
  setVendedorId,
  pin,
  setPin,
}: {
  vendedorId: string;
  setVendedorId: (v: string) => void;
  pin: string;
  setPin: (v: string) => void;
}) {
  const { data: vendedores = [] } = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Vendedor</Label>
        <Select value={vendedorId} onValueChange={setVendedorId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            {vendedores.filter((v) => v.ativo).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">PIN</Label>
        <Input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} />
      </div>
    </div>
  );
}

function CaixaPage() {
  const qc = useQueryClient();
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
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
          totais={atual.totais}
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
    </div>
  );
}

function AbrirCaixaForm({ onOpened }: { onOpened: () => void }) {
  const fn = useServerFn(abrirCaixa);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [vendedorId, setVendedorId] = useState("");
  const [pin, setPin] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { valor_inicial: valor, data, vendedor_id: vendedorId, vendedor_pin: pin } }),
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
        <VendedorPin vendedorId={vendedorId} setVendedorId={setVendedorId} pin={pin} setPin={setPin} />
        <Button onClick={() => m.mutate()} disabled={m.isPending || !vendedorId || !pin}>
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
  saldoEsperado: number;
};

function CaixaAberto({
  caixa,
  saidas,
  totais,
  onChanged,
}: {
  caixa: { id: string; data: string; saldo_inicial: number; num_fechos: number };
  saidas: Saida[];
  totais: Totais;
  onChanged: () => void;
}) {
  const addFn = useServerFn(adicionarSaida);
  const rmFn = useServerFn(removerSaida);
  const closeFn = useServerFn(fecharCaixa);
  const { currentUser } = AppRoute.useRouteContext();

  const [tipo, setTipo] = useState<"sangria" | "despesa">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [vendedorIdSaida, setVendedorIdSaida] = useState("");
  const [pinSaida, setPinSaida] = useState("");
  const [contado, setContado] = useState(0);
  const [obs, setObs] = useState("");
  const [vendedorIdFecho, setVendedorIdFecho] = useState("");
  const [pinFecho, setPinFecho] = useState("");

  const addM = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          caixa_id: caixa.id,
          tipo,
          descricao,
          valor,
          vendedor_id: vendedorIdSaida,
          vendedor_pin: pinSaida,
        },
      }),
    onSuccess: () => {
      setDescricao("");
      setValor(0);
      setPinSaida("");
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
          vendedor_id: vendedorIdFecho,
          vendedor_pin: pinFecho,
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
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase">Saldo esperado</div>
              <div className="text-lg mono font-semibold">{eur(totais.saldoEsperado)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div>MB: {eur(totais.mb)}</div>
            <div>Transferência: {eur(totais.transferencia)}</div>
            <div>Conta-corrente: {eur(totais.conta_corrente)}</div>
            <div>Sangrias: {eur(totais.sangrias)}</div>
            <div>Despesas: {eur(totais.despesas)}</div>
            <div>{totais.numPagamentos} pagamento(s)</div>
          </div>
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
            <VendedorPin
              vendedorId={vendedorIdSaida}
              setVendedorId={setVendedorIdSaida}
              pin={pinSaida}
              setPin={setPinSaida}
            />
            <Button
              onClick={() => addM.mutate()}
              disabled={addM.isPending || !descricao.trim() || valor <= 0 || !vendedorIdSaida || !pinSaida}
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
          <VendedorPin
            vendedorId={vendedorIdFecho}
            setVendedorId={setVendedorIdFecho}
            pin={pinFecho}
            setPin={setPinFecho}
          />
          {closeM.error && <div className="text-sm text-destructive">{(closeM.error as Error).message}</div>}
          <Button
            variant="destructive"
            onClick={() => closeM.mutate()}
            disabled={closeM.isPending || !vendedorIdFecho || !pinFecho || (caixa.num_fechos >= 1 && currentUser.papel !== "admin")}
          >
            {closeM.isPending ? "A fechar…" : "Fechar caixa"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
