import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOS, eliminarOS, STATUS_OS, STATUS_LABELS, type StatusOS } from "@/lib/oficina.functions";
import { Route as AppRoute } from "@/routes/_app";
import { StatusBadgeOS } from "@/components/StatusBadgeOS";
import { eur, d } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Wrench, BarChart3, Filter, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/oficina/")({
  head: () => ({
    meta: [
      { title: "Oficina — VRCF" },
      { name: "description", content: "Ordens de serviço da oficina." },
    ],
  }),
  component: OficinaPage,
});

const DEFAULT_FILTER_STATUSES: StatusOS[] = [
  "recebido", "diagnostico", "orcamento", "aprovado", "em_reparacao", "concluido",
];

function OficinaPage() {
  const qc = useQueryClient();
  const { currentUser } = AppRoute.useRouteContext();
  const isAdmin = currentUser.papel === "admin";
  const [q, setQ] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<StatusOS[]>(DEFAULT_FILTER_STATUSES);
  const eliminar = useServerFn(eliminarOS);

  // Sem filtro de estado quando há texto de pesquisa (procura em todos os estados).
  const { data: os = [], isLoading } = useQuery({
    queryKey: ["os-lista", q],
    queryFn: () => listOS({ data: { status: null, q } }),
  });

  const [alvo, setAlvo] = useState<{ id: string; numero: number } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");

  const eliminarM = useMutation({
    mutationFn: (v: { id: string; admin_password: string }) => eliminar({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["os-lista"] });
      toast.success("Ordem de serviço eliminada.");
      setAlvo(null);
      setAdminPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visiveis = q.trim() ? os : os.filter((o) => filterStatuses.includes(o.status as StatusOS));

  const stats = {
    total: os.length,
    abertos: os.filter((o) => !["concluido", "entregue"].includes(o.status)).length,
    concluidos: os.filter((o) => o.status === "concluido").length,
    entregues: os.filter((o) => o.status === "entregue").length,
  };

  function toggleStatus(s: StatusOS) {
    setFilterStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">Receção, diagnóstico, reparação e entrega.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" asChild>
              <Link to="/oficina/admin">
                <Archive className="h-4 w-4 mr-1" /> Admin
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/oficina/relatorios">
              <BarChart3 className="h-4 w-4 mr-1" /> Relatórios
            </Link>
          </Button>
          <Button asChild>
            <Link to="/oficina/nova">
              <Plus className="h-4 w-4 mr-1" /> Nova OS
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Em aberto", value: stats.abertos },
          { label: "Concluídos", value: stats.concluidos },
          { label: "Entregues", value: stats.entregues },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold font-mono">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Procurar por cliente, equipamento, nº série…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Estados
              {filterStatuses.length < STATUS_OS.length && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 ml-1">
                  {filterStatuses.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Filtrar estados</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-1.5 text-xs"
                  onClick={() =>
                    setFilterStatuses(
                      filterStatuses.length === STATUS_OS.length ? DEFAULT_FILTER_STATUSES : [...STATUS_OS],
                    )
                  }
                >
                  {filterStatuses.length === STATUS_OS.length ? "Predefinidos" : "Todos"}
                </Button>
              </div>
              {STATUS_OS.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={filterStatuses.includes(s)} onCheckedChange={() => toggleStatus(s)} />
                  <span className="text-sm">{STATUS_LABELS[s]}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Receção</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Estimado</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-10">
                  <Wrench className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  Nenhuma ordem de serviço encontrada.
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((o) => (
              <TableRow key={o.id} className="hover:bg-muted/50">
                <TableCell>
                  <Link to="/oficina/$id" params={{ id: o.id }} className="font-mono text-xs">
                    #{o.numero}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to="/oficina/$id" params={{ id: o.id }}>
                    {o.cliente_nome ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  {o.equipamento} {o.marca_modelo ? `· ${o.marca_modelo}` : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d(o.data_rececao)}</TableCell>
                <TableCell>
                  <StatusBadgeOS status={o.status as StatusOS} />
                </TableCell>
                <TableCell className="text-right">
                  {o.valor_estimado ? eur(o.valor_estimado) : "—"}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAdminPassword("");
                        setAlvo({ id: o.id, numero: Number(o.numero) });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar OS #{alvo?.numero}</DialogTitle>
            <DialogDescription>
              Esta ação é permanente. Confirme com a sua password de administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Password de administrador</Label>
            <Input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && adminPassword && alvo)
                  eliminarM.mutate({ id: alvo.id, admin_password: adminPassword });
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvo(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!adminPassword || eliminarM.isPending}
              onClick={() => alvo && eliminarM.mutate({ id: alvo.id, admin_password: adminPassword })}
            >
              {eliminarM.isPending ? "A eliminar…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
