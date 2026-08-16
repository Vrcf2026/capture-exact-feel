import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listVendedores, upsertVendedor } from "@/lib/admin.functions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/vendedores")({
  head: () => ({
    meta: [
      { title: "Vendedores — VRCF" },
      { name: "description", content: "Vendedores identificados por PIN nas vendas." },
    ],
  }),
  component: VendedoresPage,
});

type Row = Awaited<ReturnType<typeof listVendedores>>[number];

function VendedoresPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendedores</h1>
          <p className="text-sm text-muted-foreground">Identificados por PIN em cada venda; sem login.</p>
        </div>
        <Button onClick={() => setEditing({ nome: "", ativo: true })}>
          <Plus className="h-4 w-4 mr-1" /> Novo vendedor
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.nome}</TableCell>
                <TableCell>
                  {v.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(v)}>
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
            await qc.invalidateQueries({ queryKey: ["vendedores"] });
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
  const save = useServerFn(upsertVendedor);
  const m = useMutation({
    mutationFn: (v: NonNullable<NonNullable<Parameters<typeof upsertVendedor>[0]>["data"]>) => save({ data: v }),
    onSuccess: onSaved,
  });
  const [state, setState] = useState({
    id: item.id,
    nome: item.nome ?? "",
    pin: "",
    ativo: item.ativo ?? true,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={state.nome} onChange={(e) => setState({ ...state, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>
              PIN (4 a 8 dígitos)
              {item.id && <span className="text-xs text-muted-foreground ml-1">(deixar vazio para manter)</span>}
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={state.pin}
              onChange={(e) => setState({ ...state, pin: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={state.ativo} onCheckedChange={(v) => setState({ ...state, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => m.mutate({ ...state, pin: state.pin || undefined })}
            disabled={m.isPending || !state.nome.trim() || (!item.id && state.pin.length < 4)}
          >
            {m.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
