import { Badge } from "@/components/ui/badge";
import type { StatusOS } from "@/lib/oficina.functions";

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

const VARIANTS: Record<StatusOS, string> = {
  rececionado: "bg-muted text-muted-foreground",
  em_diagnostico: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  aguardar_aprovacao: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  aprovado: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  em_reparacao: "bg-primary/15 text-primary",
  pronto: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  entregue: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400",
  cancelado: "bg-destructive/15 text-destructive",
};

export function StatusBadgeOS({ status }: { status: StatusOS }) {
  return (
    <Badge variant="outline" className={`border-0 ${VARIANTS[status]}`}>
      {LABELS[status]}
    </Badge>
  );
}
