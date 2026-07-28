import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listRegistos } from "@/lib/loja.functions";
import { listClientes } from "@/lib/admin.functions";
import { eur, dt } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/registos/")({
  head: () => ({
    meta: [
      { title: "Registos — VRCF" },
      { name: "description", content: "Histórico de vendas emitidas." },
    ],
  }),
  component: RegistosPage,
});

function RegistosPage() {
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [incluirAnulados, setIncluirAnulados] = useState(false);
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });

  const filtros = useMemo(
    () => ({
      desde: desde ? new Date(desde).toISOString() : null,
      ate: ate ? new Date(new Date(ate).setHours(23, 59, 59, 999)).toISOString() : null,
      cliente_id: clienteId,
      incluir_anulados: incluirAnulados,
    }),
    [desde, ate, clienteId, incluirAnulados],
  );

  const { data = [] } = useQuery({
    queryKey: ["registos", filtros],
    queryFn: () => listRegistos({ data: filtros }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Registos</h1>
          <p className="text-sm text-muted-foreground">Histórico de vendas.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] items-end rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={clienteId ?? "__all"} onValueChange={(v) => setClienteId(v === "__all" ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <Switch checked={incluirAnulados} onCheckedChange={setIncluirAnulados} />
          <Label>Incluir anulados</Label>
        </div>
        <Button
          variant="ghost"
          onClick={() => { setDesde(""); setAte(""); setClienteId(null); setIncluirAnulados(false); }}
        >
          Limpar
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sem registos.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => {
                const cli = r.cliente as { nome?: string } | null;
                const utl = r.utilizador as { nome?: string } | null;
                const vnd = r.vendedor as { nome?: string } | null;
                return (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="mono">
                      <Link to="/registos/$id" params={{ id: r.id }} className="text-primary hover:underline">
                        #{r.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dt(r.data)}</TableCell>
                    <TableCell>{cli?.nome ?? "Consumidor final"}</TableCell>
                    <TableCell>{vnd?.nome ?? utl?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right mono">{eur(r.total)}</TableCell>
                    <TableCell>
                      {r.anulado ? (
                        <Badge variant="destructive">Anulado</Badge>
                      ) : r.faturado ? (
                        <Badge>Faturado</Badge>
                      ) : (
                        <Badge variant="outline">Emitido</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
