import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listOS, STATUS_OS, type StatusOS } from "@/lib/oficina.functions";
import { StatusBadgeOS } from "@/components/StatusBadgeOS";
import { eur, d } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Wrench } from "lucide-react";

export const Route = createFileRoute("/_app/oficina/")({
  head: () => ({
    meta: [
      { title: "Oficina — VRCF" },
      { name: "description", content: "Ordens de serviço da oficina." },
    ],
  }),
  component: OficinaPage,
});

const LABELS: Record<StatusOS, string> = {
  rececionado: "Rececionado",
  em_diagnostico: "Em diagnóstico",
  aguardar_aprovacao: "Aguarda aprovação",
  aprovado: "Aprovado",
  em_reparacao: "Em reparação",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function OficinaPage() {
  const [status, setStatus] = useState<StatusOS | "todos">("todos");
  const [q, setQ] = useState("");
  const { data: os = [], isLoading } = useQuery({
    queryKey: ["os", status, q],
    queryFn: () => listOS({ data: { status: status === "todos" ? null : status, q } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">Receção, diagnóstico, reparação e entrega.</p>
        </div>
        <Button asChild>
          <Link to="/oficina/nova">
            <Plus className="h-4 w-4 mr-1" /> Nova OS
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Procurar por cliente, equipamento, nº série…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusOS | "todos")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            {STATUS_OS.map((s) => (
              <SelectItem key={s} value={s}>
                {LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && os.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  <Wrench className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  Nenhuma ordem de serviço encontrada.
                </TableCell>
              </TableRow>
            )}
            {os.map((o) => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
