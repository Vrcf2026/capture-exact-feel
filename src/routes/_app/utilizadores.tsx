import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listUtilizadores, upsertUtilizador } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil } from "lucide-react";
import { dt } from "@/lib/format";

export const Route = createFileRoute("/_app/utilizadores")({
  head: () => ({
    meta: [
      { title: "Utilizadores — VRCF" },
      { name: "description", content: "Gestão de contas com acesso à aplicação." },
    ],
  }),
  component: UtilizadoresPage,
});

type Row = Awaited<ReturnType<typeof listUtilizadores>>[number];
type Papel = "admin" | "operador" | "tecnico";

function UtilizadoresPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["utilizadores"], queryFn: () => listUtilizadores() });
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Utilizadores</h1>
          <p className="text-sm text-muted-foreground">Contas com login (nome + password).</p>
        </div>
        <Button onClick={() => setEditing({ papel: "operador", acesso_loja: true, acesso_oficina: false, ativo: true, nome: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Novo utilizador
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{u.papel}</Badge></TableCell>
                <TableCell>{u.acesso_loja ? "Sim" : "—"}</TableCell>
                <TableCell>{u.acesso_oficina ? "Sim" : "—"}</TableCell>
                <TableCell>
                  {u.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{dt(u.created_at)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await qc.invalidateQueries({ queryKey: ["utilizadores"] });
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  item, onClose, onSaved,
}: {
  item: Partial<Row>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertUtilizador);
  const m = useMutation({
    mutationFn: (v: NonNullable<NonNullable<Parameters<typeof upsertUtilizador>[0]>["data"]>) => save({ data: v }),
    onSuccess: onSaved,
  });
  const [state, setState] = useState({
    id: item.id,
    nome: item.nome ?? "",
    password: "",
    papel: (item.papel ?? "operador") as Papel,
    acesso_loja: item.acesso_loja ?? true,
    acesso_oficina: item.acesso_oficina ?? false,
    ativo: item.ativo ?? true,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Editar utilizador" : "Novo utilizador"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={state.nome} onChange={(e) => setState({ ...state, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Password {item.id && <span className="text-xs text-muted-foreground">(deixar em branco para manter)</span>}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={state.papel} onValueChange={(v) => setState({ ...state, papel: v as Papel })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={state.acesso_loja} onCheckedChange={(v) => setState({ ...state, acesso_loja: v })} />
              <Label>Loja</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={state.acesso_oficina} onCheckedChange={(v) => setState({ ...state, acesso_oficina: v })} />
              <Label>Oficina</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={state.ativo} onCheckedChange={(v) => setState({ ...state, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          {state.password.length > 0 && state.password.length < 6 && (
            <div className="text-sm text-destructive">A password tem de ter pelo menos 6 caracteres.</div>
          )}
          {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              const payload = { ...state, password: state.password || undefined };
              m.mutate(payload);
            }}
            disabled={m.isPending || !state.nome.trim() || (!item.id && !state.password)}
          >
            {m.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
