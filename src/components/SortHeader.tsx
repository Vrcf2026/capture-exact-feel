import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/** Cabeçalho de tabela clicável com setas de ordenação. */
export function SortHeader<K extends string>({
  campo,
  sort,
  onSort,
  children,
  align = "left",
  className,
}: {
  campo: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const ativo = sort.key === campo;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        className={`flex w-full items-center gap-1 select-none hover:text-foreground ${
          align === "right" ? "justify-end" : ""
        } ${ativo ? "text-foreground font-medium" : ""}`}
      >
        <span>{children}</span>
        {ativo ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/** Comparador genérico para strings/números/booleanos com nulos no fim. */
export function comparar(a: unknown, b: unknown, dir: SortDir) {
  const nulo = (v: unknown) => v === null || v === undefined || v === "";
  if (nulo(a) && nulo(b)) return 0;
  if (nulo(a)) return 1;
  if (nulo(b)) return -1;
  let r: number;
  if (typeof a === "number" && typeof b === "number") r = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean") r = Number(a) - Number(b);
  else r = String(a).localeCompare(String(b), "pt", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? r : -r;
}
