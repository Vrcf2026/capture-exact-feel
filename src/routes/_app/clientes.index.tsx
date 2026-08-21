import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { SortHeader, comparar, type SortState } from "@/components/SortHeader";

import { listClientes, upsertCliente, deleteCliente } from "@/lib/admin.functions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — VRCF" },
      { name: "description", content: "Ficheiro de clientes da loja e oficina." },
    ],
  }),
  component: ClientesPage,
});

type Cliente = Awaited<ReturnType<typeof listClientes>>[number];

type SortKey = "nome" | "nif" | "telefone" | "email" | "linha_preco";

function ClientesPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "nome", dir: "asc" });
  const [editing, setEditing] = useState<Partial<Cliente> | null>(null);

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));

  const termos = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = useMemo(() => {
    const base = data.filter((c) => {
      const texto = `${c.nome} ${c.nif ?? ""} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase();
      return termos.every((t) => texto.includes(t));
    });
    const valor = (c: Cliente) => {
      switch (sort.key) {
        case "nome": return c.nome;
        case "nif": return c.nif ?? "";
        case "telefone": return c.telefone ?? "";
        case "email": return c.email ?? "";
        case "linha_preco": return Number(c.linha_preco);
      }
    };
    return [...base].sort((a, b) => comparar(valor(a), valor(b), sort.dir));
  }, [data, termos.join(" "), sort]);


  const delFn = useServerFn(deleteCliente);
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
    onError: (e: Error) => window.alert(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Contactos e faturação.</p>
        </div>
        <Button onClick={() => setEditing({ nome: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Procurar por nome, NIF, telefone ou email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} de {data.length}</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader campo="nome" sort={sort} onSort={onSort}>Nome</SortHeader>
              <SortHeader campo="nif" sort={sort} onSort={onSort}>NIF</SortHeader>
              <SortHeader campo="telefone" sort={sort} onSort={onSort}>Telefone</SortHeader>
              <SortHeader campo="email" sort={sort} onSort={onSort}>Email</SortHeader>
              <SortHeader campo="linha_preco" sort={sort} onSort={onSort}>Preço</SortHeader>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sem clientes.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="text-primary hover:underline">
                      {c.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="mono">{c.nif ?? "—"}</TableCell>
                  <TableCell className="mono">{c.telefone ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.email ?? "—"}</TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {c.linha_preco === 2 ? "Preço 2" : "Preço 1"}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Eliminar "${c.nome}"?`)) delM.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
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
            await qc.invalidateQueries({ queryKey: ["clientes"] });
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
  item: Partial<Cliente>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertCliente);
  const m = useMutation({
    mutationFn: (v: NonNullable<NonNullable<Parameters<typeof upsertCliente>[0]>["data"]>) => save({ data: v }),
    onSuccess: onSaved,
  });
  const [state, setState] = useState({
    id: item.id,
    nome: item.nome ?? "",
    nif: item.nif ?? "",
    telefone: item.telefone ?? "",
    email: item.email ?? "",
    linha_preco: (item.linha_preco === 2 ? 2 : 1) as 1 | 2,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={state.nome} onChange={(e) => setState({ ...state, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>NIF</Label>
              <Input value={state.nif} onChange={(e) => setState({ ...state, nif: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={state.telefone} onChange={(e) => setState({ ...state, telefone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="cliente@exemplo.pt"
              value={state.email}
              onChange={(e) => setState({ ...state, email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preço a aplicar</Label>
            <Select value={String(state.linha_preco)} onValueChange={(v) => setState({ ...state, linha_preco: Number(v) as 1 | 2 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Preço 1 (normal)</SelectItem>
                <SelectItem value="2">Preço 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
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
