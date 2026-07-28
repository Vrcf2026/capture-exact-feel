import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type StatusOS } from "@/lib/oficina.functions";

const VARIANTS: Record<StatusOS, string> = {
  recebido: "bg-muted text-muted-foreground",
  diagnostico: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  orcamento: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  aprovado: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  nao_aprovado: "bg-destructive/15 text-destructive",
  em_reparacao: "bg-primary/15 text-primary",
  sem_reparacao: "bg-destructive/15 text-destructive",
  concluido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  entregue: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400",
};

export function StatusBadgeOS({ status }: { status: StatusOS }) {
  return (
    <Badge variant="outline" className={`border-0 ${VARIANTS[status]}`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
