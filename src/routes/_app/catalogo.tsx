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

function CatalogoPage() {
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["catalogo"], queryFn: () => listCatalogo() });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  const filtered = data.filter((i) => i.nome.toLowerCase().includes(q.toLowerCase()));

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
        {isAdmin && (
          <Button onClick={() => setEditing({ tipo: "produto", unidade: "unidade", ativo: true, preco: 0, preco2: 0, nome: "" })}>
            <Plus className="h-4 w-4 mr-1" /> Novo item
          </Button>
        )}
      </div>

      <Input
        placeholder="Procurar…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Preço 2</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Estado</TableHead>
              {isAdmin && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                  Sem itens.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.nome}</TableCell>
                  <TableCell>
                    <Badge variant={i.tipo === "produto" ? "secondary" : "outline"}>{i.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right mono">{eur(i.preco)}</TableCell>
                  <TableCell className="text-right mono text-muted-foreground">
                    {eur(i.preco2)}
                  </TableCell>
                  <TableCell>{i.unidade}</TableCell>
                  <TableCell>
                    {i.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Desativar "${i.nome}"?`)) delM.mutate(i.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
    nome: item.nome ?? "",
    tipo: (item.tipo ?? "produto") as "produto" | "servico",
    preco: Number(item.preco ?? 0),
    preco2: Number(item.preco2 ?? 0),
    unidade: item.unidade ?? "unidade",
    ativo: item.ativo ?? true,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={state.nome} onChange={(e) => setState({ ...state, nome: e.target.value })} />
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
