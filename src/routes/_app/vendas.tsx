import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { criarVenda } from "@/lib/loja.functions";
import { listCatalogo, listClientes } from "@/lib/admin.functions";
import { useVendedorObrigatorio } from "@/components/IdentificarVendedor";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/vendas")({
  head: () => ({
    meta: [
      { title: "Nova venda — VRCF" },
      { name: "description", content: "Emissão de registos de venda com múltiplos pagamentos." },
    ],
  }),
  component: NovaVendaPage,
});

type Metodo = "dinheiro" | "mb" | "transferencia" | "conta_corrente" | "cheque" | "outro";
type Item = { key: string; catalogo_id: string | null; descricao: string; quantidade: number; preco_unitario: number };
type Pag = { key: string; metodo: Metodo; valor: number };

const METODOS: { v: Metodo; label: string }[] = [
  { v: "dinheiro", label: "Dinheiro" },
  { v: "mb", label: "Multibanco" },
  { v: "transferencia", label: "Transferência" },
  { v: "conta_corrente", label: "Conta-corrente" },
  { v: "cheque", label: "Cheque" },
  { v: "outro", label: "Outro" },
];

function uid() { return Math.random().toString(36).slice(2); }

function NovaVendaPage() {
  const navigate = useNavigate();
  const { data: catalogo = [] } = useQuery({ queryKey: ["catalogo"], queryFn: () => listCatalogo() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const criar = useServerFn(criarVenda);
  const { vendedorId, vendedorNome, vendedorPin, trocarVendedor, dialog, pronto } = useVendedorObrigatorio();

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([
    { key: uid(), catalogo_id: null, descricao: "", quantidade: 1, preco_unitario: 0 },
  ]);

  const [pags, setPags] = useState<Pag[]>([{ key: uid(), metodo: "dinheiro", valor: 0 }]);
  const [notas, setNotas] = useState("");

  const total = useMemo(
    () => itens.reduce((s, it) => s + Math.round(it.quantidade * it.preco_unitario * 100) / 100, 0),
    [itens],
  );
  const somaPag = pags.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const troco = somaPag - total;

  function adicionarDoCatalogo(id: string) {
    const i = catalogo.find((c) => c.id === id);
    if (!i) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    const usarPreco2 = cliente?.linha_preco === 2 && Number(i.preco2) > 0;
    setItens((prev) => [
      ...prev,
      {
        key: uid(),
        catalogo_id: i.id,
        descricao: i.nome,
        quantidade: 1,
        preco_unitario: usarPreco2 ? Number(i.preco2) : Number(i.preco),
      },
    ]);
  }
  function adicionarLivre() {
    setItens((prev) => [
      ...prev,
      { key: uid(), catalogo_id: null, descricao: "", quantidade: 1, preco_unitario: 0 },
    ]);
  }

  const m = useMutation({
    mutationFn: () =>
      criar({
        data: {
          cliente_id: clienteId,
          vendedor_id: vendedorId,
          vendedor_pin: vendedorPin ?? undefined,
          itens: itens.map((i) => ({
            catalogo_id: i.catalogo_id,
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
          pagamentos: pags
            .filter((p) => p.valor > 0)
            .map((p) => ({ metodo: p.metodo, valor: p.valor })),
          notas: notas || null,
        },
      }),
    onSuccess: (r) => navigate({ to: "/registos/$id", params: { id: r.id } }),
  });

  const conta = pags.some((p) => p.metodo === "conta_corrente");
  const podeSubmeter =
    pronto &&
    itens.length > 0 &&
    itens.every((i) => i.descricao.trim() && i.quantidade > 0 && i.preco_unitario >= 0) &&
    somaPag > 0 &&
    Math.abs(somaPag - total) < 0.01 &&
    (!conta || clienteId);

  return (
    <div className="space-y-6">
      {dialog}
      <div>
        <h1 className="text-2xl font-semibold">Nova venda</h1>
        <p className="text-sm text-muted-foreground">Registo com múltiplos itens e formas de pagamento.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Itens</CardTitle>
                <PickerCatalogo
                  itens={catalogo}
                  onSelect={(i) => i && adicionarDoCatalogo(i.id)}
                  triggerLabel="Adicionar do catálogo…"
                />
              </div>
            </CardHeader>


            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-24 text-right">Qtd.</TableHead>
                    <TableHead className="w-32 text-right">Preço</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it, idx) => (

                      <TableRow key={it.key}>
                        <TableCell>
                          <Input
                            value={it.descricao}
                            onChange={(e) => {
                              const c = [...itens]; c[idx] = { ...it, descricao: e.target.value }; setItens(c);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="text-right mono"
                            type="number" step="0.01" min="0"
                            value={it.quantidade}
                            onChange={(e) => {
                              const c = [...itens]; c[idx] = { ...it, quantidade: Number(e.target.value) }; setItens(c);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="text-right mono"
                            type="number" step="0.01" min="0"
                            value={it.preco_unitario}
                            onChange={(e) => {
                              const c = [...itens]; c[idx] = { ...it, preco_unitario: Number(e.target.value) }; setItens(c);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right mono">
                          {eur(it.quantidade * it.preco_unitario)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => setItens(itens.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border p-3">
                <Button size="sm" variant="outline" onClick={adicionarLivre}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar linha
                </Button>
              </div>
            </CardContent>

          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente e vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select
                  value={clienteId ?? "__none"}
                  onValueChange={(v) => setClienteId(v === "__none" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Consumidor final</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendedor</Label>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{vendedorNome ?? "—"}</span>
                  <Button size="sm" variant="ghost" onClick={trocarVendedor}>
                    Trocar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Pagamentos</CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => setPags([...pags, { key: uid(), metodo: "dinheiro", valor: 0 }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {pags.map((p, idx) => (
                <div key={p.key} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <Select
                    value={p.metodo}
                    onValueChange={(v) => {
                      const c = [...pags]; c[idx] = { ...p, metodo: v as Metodo }; setPags(c);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METODOS.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    className="text-right mono"
                    type="number" step="0.01" min="0"
                    value={p.valor}
                    onChange={(e) => {
                      const c = [...pags]; c[idx] = { ...p, valor: Number(e.target.value) }; setPags(c);
                    }}
                  />
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => setPags(pags.filter((_, i) => i !== idx))}
                    disabled={pags.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm" variant="secondary"
                onClick={() => {
                  const restante = Math.max(0, +(total - somaPag + (pags[pags.length - 1]?.valor ?? 0)).toFixed(2));
                  const c = [...pags];
                  if (c.length > 0) c[c.length - 1] = { ...c[c.length - 1], valor: restante };
                  setPags(c);
                }}
              >
                Preencher restante
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <Line label="Total" value={eur(total)} strong />
              <Line label="Pago" value={eur(somaPag)} />
              <Line
                label={troco >= 0 ? "Troco" : "Em falta"}
                value={eur(Math.abs(troco))}
                tone={Math.abs(troco) < 0.01 ? "muted" : troco < 0 ? "danger" : "muted"}
              />
              {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
              <Button
                className="w-full"
                size="lg"
                disabled={!podeSubmeter || m.isPending}
                onClick={() => m.mutate()}
              >
                {m.isPending ? "A guardar…" : "Guardar venda"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({
  label, value, strong, tone,
}: { label: string; value: string; strong?: boolean; tone?: "muted" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <div className={`text-sm ${tone === "muted" ? "text-muted-foreground" : ""}`}>{label}</div>
      <div className={`mono ${strong ? "text-lg font-semibold" : "text-sm"} ${tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}
