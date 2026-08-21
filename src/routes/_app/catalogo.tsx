import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCatalogo, upsertCatalogo, deleteCatalogo } from "@/lib/admin.functions";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Route as AppRoute } from "@/routes/_app";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — VRCF" },
      { name: "description", content: "Produtos e serviços da loja e oficina." },
    ],
  }),
  component: CatalogoPage,
});

type Item = Awaited<ReturnType<typeof listCatalogo>>[number];

type SortKey = "codigo" | "nome" | "tipo" | "preco" | "preco2" | "stock" | "ativo";

function CatalogoPage() {
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
  const podeEditar = isAdmin || currentUser.acesso_loja;
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["catalogo"], queryFn: () => listCatalogo() });
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos" | "stock_baixo">("ativos");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "nome", dir: "asc" });
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));

  const termos = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = useMemo(() => {
    const base = data.filter((i) => {
      if (filtro === "ativos" && !i.ativo) return false;
      if (filtro === "inativos" && i.ativo) return false;
      if (filtro === "stock_baixo" && !(i.controla_stock && Number(i.stock) <= Number(i.stock_minimo)))
        return false;
      const texto = `${i.codigo ?? ""} ${i.nome} ${i.tipo} ${i.unidade}`.toLowerCase();
      return termos.every((t) => texto.includes(t));
    });
    const valor = (i: Item) => {
      switch (sort.key) {
        case "codigo": return i.codigo ?? "";
        case "nome": return i.nome;
        case "tipo": return i.tipo;
        case "preco": return Number(i.preco);
        case "preco2": return Number(i.preco2);
        case "stock": return i.controla_stock ? Number(i.stock) : null;
        case "ativo": return Boolean(i.ativo);
      }
    };
    return [...base].sort((a, b) => comparar(valor(a), valor(b), sort.dir));
  }, [data, termos.join(" "), filtro, sort]);


  const delFn = useServerFn(deleteCatalogo);
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Produtos e serviços partilhados entre Loja e Oficina.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={() => setEditing({ tipo: "produto", unidade: "unidade", ativo: true, preco: 0, preco2: 0, nome: "", codigo: "", controla_stock: false, stock: 0, stock_minimo: 0 })}>
            <Plus className="h-4 w-4 mr-1" /> Novo item
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Procurar (código, nome, tipo, unidade)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Só ativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="inativos">Só inativos</SelectItem>
            <SelectItem value="stock_baixo">Stock baixo</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} de {data.length}</span>
      </div>


      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader campo="codigo" sort={sort} onSort={onSort} className="w-28">Código</SortHeader>
              <SortHeader campo="nome" sort={sort} onSort={onSort}>Nome</SortHeader>
              <SortHeader campo="tipo" sort={sort} onSort={onSort}>Tipo</SortHeader>
              <SortHeader campo="preco" sort={sort} onSort={onSort} align="right">Preço</SortHeader>
              <SortHeader campo="preco2" sort={sort} onSort={onSort} align="right">Preço 2</SortHeader>
              <TableHead>Unidade</TableHead>
              <SortHeader campo="stock" sort={sort} onSort={onSort} align="right">Stock</SortHeader>
              <SortHeader campo="ativo" sort={sort} onSort={onSort}>Estado</SortHeader>
              {podeEditar && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={podeEditar ? 9 : 8} className="text-center text-muted-foreground py-8">
                  Sem itens.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="mono text-xs text-muted-foreground">{i.codigo ?? "—"}</TableCell>
                  <TableCell className="font-medium">{i.nome}</TableCell>


                  <TableCell>
                    <Badge variant={i.tipo === "produto" ? "secondary" : "outline"}>{i.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right mono">{eur(i.preco)}</TableCell>
                  <TableCell className="text-right mono text-muted-foreground">
                    {eur(i.preco2)}
                  </TableCell>
                  <TableCell>{i.unidade}</TableCell>
                  <TableCell className="text-right mono">
                    {i.controla_stock ? (
                      <span className={Number(i.stock) <= Number(i.stock_minimo) ? "text-destructive font-semibold" : ""}>
                        {Number(i.stock)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  {podeEditar && (
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Desativar "${i.nome}"?`)) delM.mutate(i.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await qc.invalidateQueries({ queryKey: ["catalogo"] });
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: Partial<Item>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertCatalogo);
  const m = useMutation({
    mutationFn: (v: NonNullable<NonNullable<Parameters<typeof upsertCatalogo>[0]>["data"]>) => save({ data: v }),
    onSuccess: onSaved,
  });
  const [state, setState] = useState({
    id: item.id,
    codigo: item.codigo ?? "",
    nome: item.nome ?? "",
    tipo: (item.tipo ?? "produto") as "produto" | "servico",
    preco: Number(item.preco ?? 0),
    preco2: Number(item.preco2 ?? 0),
    unidade: item.unidade ?? "unidade",
    ativo: item.ativo ?? true,
    controla_stock: item.controla_stock ?? false,
    stock: Number(item.stock ?? 0),
    stock_minimo: Number(item.stock_minimo ?? 0),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                className="mono"
                placeholder="Ex: SSD500"
                value={state.codigo}
                onChange={(e) => setState({ ...state, codigo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={state.nome} onChange={(e) => setState({ ...state, nome: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={state.tipo}
                onValueChange={(v) => setState({ ...state, tipo: v as typeof state.tipo })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={state.unidade} onChange={(e) => setState({ ...state, unidade: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Preço (€)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={state.preco}
                onChange={(e) => setState({ ...state, preco: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço 2 (€)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={state.preco2}
                onChange={(e) => setState({ ...state, preco2: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={state.ativo} onCheckedChange={(v) => setState({ ...state, ativo: v })} />
            <Label>Ativo</Label>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={state.controla_stock}
                onCheckedChange={(v) => setState({ ...state, controla_stock: v })}
              />
              <Label>Controlar stock deste artigo</Label>
            </div>
            {state.controla_stock && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{item.id ? "Stock atual" : "Stock inicial"}</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    disabled={!!item.id}
                    value={state.stock}
                    onChange={(e) => setState({ ...state, stock: Number(e.target.value) })}
                  />
                  {item.id && (
                    <p className="text-xs text-muted-foreground">
                      Alterado apenas por entradas/saídas na página Stocks.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Stock mínimo</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={state.stock_minimo}
                    onChange={(e) => setState({ ...state, stock_minimo: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>
          {m.error && (
            <div className="text-sm text-destructive">{(m.error as Error).message}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate(state)} disabled={m.isPending || !state.nome.trim()}>
            {m.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
