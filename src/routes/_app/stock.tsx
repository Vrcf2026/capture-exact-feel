import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listStock, listMovimentos, registarMovimento, resumoPorVendedor } from "@/lib/stock.functions";
import { listVendedores } from "@/lib/admin.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, History, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/stock")({
  head: () => ({
    meta: [
      { title: "Stocks — VRCF" },
      { name: "description", content: "Stock atual, entradas e saídas justificadas de artigos." },
      { property: "og:title", content: "Stocks — VRCF" },
      { property: "og:description", content: "Gestão de stock: entradas, saídas justificadas e histórico." },
    ],
  }),
  component: StockPage,
});

type Artigo = Awaited<ReturnType<typeof listStock>>[number];

function StockPage() {
  const qc = useQueryClient();
  const { data: artigos = [] } = useQuery({ queryKey: ["stock"], queryFn: () => listStock() });
  const movFn = useServerFn(listMovimentos);
  const { data: movs = [] } = useQuery({
    queryKey: ["stock-movimentos"],
    queryFn: () => movFn({ data: { limite: 100 } }),
  });
  const [q, setQ] = useState("");
  const [mov, setMov] = useState<{ artigo: Artigo; tipo: "entrada" | "saida" | "ajuste" } | null>(null);

  const termo = q.toLowerCase().trim();
  const filtrados = artigos.filter(
    (a) => !termo || a.nome.toLowerCase().includes(termo) || (a.codigo ?? "").toLowerCase().includes(termo),
  );
  const abaixo = artigos.filter((a) => Number(a.stock) <= Number(a.stock_minimo));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Stocks</h1>
        <p className="text-sm text-muted-foreground">
          As vendas dão saída automática. Saídas sem venda têm de ser justificadas.
        </p>
      </div>

      {abaixo.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> {abaixo.length} artigo(s) no ou abaixo do stock mínimo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {abaixo.map((a) => (
              <Badge key={a.id} variant="outline">
                {a.nome} · {Number(a.stock)} {a.unidade}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4" /> Artigos com controlo de stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Procurar por código ou nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Artigo</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="w-64"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum artigo com controlo de stock. Ative "Controlar stock" no catálogo.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="mono text-xs text-muted-foreground">{a.codigo ?? "—"}</TableCell>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell
                        className={`text-right mono ${Number(a.stock) <= Number(a.stock_minimo) ? "text-destructive font-semibold" : ""}`}
                      >
                        {Number(a.stock)} {a.unidade}
                      </TableCell>
                      <TableCell className="text-right mono text-muted-foreground">
                        {Number(a.stock_minimo)}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => setMov({ artigo: a, tipo: "entrada" })}>
                          <ArrowDownToLine className="h-4 w-4 mr-1" /> Entrada
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setMov({ artigo: a, tipo: "saida" })}>
                          <ArrowUpFromLine className="h-4 w-4 mr-1" /> Saída
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Últimos movimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Artigo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Stock após</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Utilizador</TableHead>
                </TableRow>

              </TableHeader>
              <TableBody>
                {movs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Sem movimentos.
                    </TableCell>
                  </TableRow>
                ) : (
                  movs.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.criado_em).toLocaleString("pt-PT")}
                      </TableCell>
                      <TableCell className="font-medium">{m.catalogo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.tipo === "entrada" ? "secondary" : m.tipo === "saida" ? "destructive" : "outline"}>
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right mono">{Number(m.quantidade)}</TableCell>
                      <TableCell className="text-right mono text-muted-foreground">
                        {m.stock_apos === null ? "—" : Number(m.stock_apos)}
                      </TableCell>
                      <TableCell className="text-sm">{m.motivo ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.utilizador?.nome ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {mov && (
        <MovDialog
          artigo={mov.artigo}
          tipoInicial={mov.tipo}
          onClose={() => setMov(null)}
          onSaved={async () => {
            setMov(null);
            await Promise.all([
              qc.invalidateQueries({ queryKey: ["stock"] }),
              qc.invalidateQueries({ queryKey: ["stock-movimentos"] }),
              qc.invalidateQueries({ queryKey: ["catalogo"] }),
            ]);
          }}
        />
      )}
    </div>
  );
}

function MovDialog({
  artigo,
  tipoInicial,
  onClose,
  onSaved,
}: {
  artigo: Artigo;
  tipoInicial: "entrada" | "saida" | "ajuste";
  onClose: () => void;
  onSaved: () => void;
}) {
  const fn = useServerFn(registarMovimento);
  const { data: vendedores = [] } = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });
  const [tipo, setTipo] = useState(tipoInicial);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [motivo, setMotivo] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!vendedorId) {
      const ativo = vendedores.find((v) => v.ativo);
      if (ativo) setVendedorId(ativo.id);
    }
  }, [vendedores, vendedorId]);

  const m = useMutation({
    mutationFn: () =>
      fn({
        data: { catalogo_id: artigo.id, tipo, quantidade, motivo, vendedor_id: vendedorId, vendedor_pin: pin },
      }),
    onSuccess: (r) => {
      toast.success(`Movimento registado por ${r.vendedor}. Stock atual: ${r.stock}`);
      onSaved();
    },
  });

  const precisaMotivo = tipo !== "entrada";
  const bloqueio =
    !quantidade || quantidade <= 0
      ? "Indique a quantidade."
      : precisaMotivo && motivo.trim().length < 3
        ? "Justifique a saída/ajuste."
        : !vendedorId
          ? "Escolha o vendedor responsável."
          : !/^\d{4,8}$/.test(pin)
            ? "Introduza o PIN do vendedor."
            : null;


  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Movimento de stock — {artigo.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Stock atual: <span className="mono font-medium">{Number(artigo.stock)} {artigo.unidade}</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (compra/devolução)</SelectItem>
                  <SelectItem value="saida">Saída sem venda</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tipo === "ajuste" ? "Stock contado" : "Quantidade"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              Motivo {precisaMotivo ? <span className="text-destructive">*</span> : "(opcional)"}
            </Label>
            <Textarea
              rows={3}
              placeholder={
                tipo === "entrada"
                  ? "Ex.: Compra fornecedor X, fatura 123"
                  : tipo === "saida"
                    ? "Ex.: Uso interno, quebra, garantia, oferta…"
                    : "Ex.: Correção após contagem física"
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3">
            <div className="space-y-1.5">
              <Label>Vendedor responsável <span className="text-destructive">*</span></Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {vendedores.filter((v) => v.ativo).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>PIN <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
          </div>

          {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
          {bloqueio && <div className="text-xs text-muted-foreground">{bloqueio}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !!bloqueio}>
            {m.isPending ? "A guardar…" : "Registar movimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
