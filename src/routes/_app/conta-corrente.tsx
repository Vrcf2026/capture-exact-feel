import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { liquidarPagamento, listContaCorrente } from "@/lib/loja.functions";
import { listVendedores } from "@/lib/admin.functions";
import { eur, dt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_app/conta-corrente")({
  head: () => ({
    meta: [
      { title: "Conta-corrente — VRCF" },
      { name: "description", content: "Pagamentos em aberto a receber de clientes." },
    ],
  }),
  component: ContaCorrentePage,
});

type Row = {
  id: string; valor: number; data: string; liquidado: boolean; ja_pago: number; saldo: number;
  registo: {
    id: string; numero: number; data: string; anulado: boolean;
    cliente: { id: string; nome: string; nif: string | null; telefone: string | null } | null;
  } | null;
};

const METODOS = [
  { v: "dinheiro", label: "Dinheiro" },
  { v: "mb", label: "Multibanco" },
  { v: "transferencia", label: "Transferência" },
  { v: "cheque", label: "Cheque" },
  { v: "outro", label: "Outro" },
] as const;

function LiquidarDialog({ divida, onDone }: { divida: Row; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(divida.saldo);
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]["v"]>("dinheiro");
  const [vendedorId, setVendedorId] = useState("");
  const [pin, setPin] = useState("");
  const { data: vendedores = [] } = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });

  const liq = useServerFn(liquidarPagamento);
  const m = useMutation({
    mutationFn: () =>
      liq({
        data: { pagamento_id: divida.id, valor, metodo, vendedor_id: vendedorId, vendedor_pin: pin },
      }),
    onSuccess: () => {
      setOpen(false);
      setPin("");
      onDone();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Liquidar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liquidar dívida — {eur(divida.saldo)} em falta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor a receber (€)</Label>
              <Input
                type="number" step="0.01" min="0.01" max={divida.saldo}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Método</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as typeof metodo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendedor</Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {vendedores.filter((v) => v.ativo).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
          </div>
          {m.error && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || valor <= 0 || valor > divida.saldo || !vendedorId || !pin}
          >
            {m.isPending ? "A registar…" : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContaCorrentePage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["cc"],
    queryFn: () => listContaCorrente() as unknown as Promise<Row[]>,
  });

  const totalAberto = data.reduce((s, r) => s + r.saldo, 0);

  const porCliente = new Map<string, { nome: string; total: number; itens: Row[] }>();
  for (const r of data) {
    const cli = r.registo?.cliente;
    if (!cli) continue;
    const key = cli.id;
    if (!porCliente.has(key)) porCliente.set(key, { nome: cli.nome, total: 0, itens: [] });
    const bucket = porCliente.get(key)!;
    bucket.total += r.saldo;
    bucket.itens.push(r);
  }

  const onDone = () => qc.invalidateQueries({ queryKey: ["cc"] });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conta-corrente</h1>
          <p className="text-sm text-muted-foreground">Pagamentos em conta-corrente por liquidar.</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Total em aberto</div>
          <div className="mono text-2xl font-semibold">{eur(totalAberto)}</div>
        </div>
      </div>

      {porCliente.size === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Sem pagamentos em aberto.
          </CardContent>
        </Card>
      ) : (
        [...porCliente.entries()].map(([id, bucket]) => (
          <Card key={id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{bucket.nome}</CardTitle>
              <div className="mono font-semibold">{eur(bucket.total)}</div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead className="text-right">Já pago</TableHead>
                    <TableHead className="text-right">Em falta</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bucket.itens.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="mono">
                        {r.registo && (
                          <Link to="/registos/$id" params={{ id: r.registo.id }} className="text-primary hover:underline">
                            #{r.registo.numero}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dt(r.data)}</TableCell>
                      <TableCell className="text-right mono">{eur(r.valor)}</TableCell>
                      <TableCell className="text-right mono">{eur(r.ja_pago)}</TableCell>
                      <TableCell className="text-right mono font-medium">{eur(r.saldo)}</TableCell>
                      <TableCell>
                        <LiquidarDialog divida={r} onDone={onDone} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
