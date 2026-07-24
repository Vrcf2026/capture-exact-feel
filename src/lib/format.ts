// Helpers de formatação PT-PT.

export function eur(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}

export function num(n: number | string | null | undefined, decimals = 2): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(v) ? v : 0);
}

export function dt(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function d(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const dd = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dd);
}

export function isoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const METODOS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "mb", label: "Multibanco" },
  { value: "transferencia", label: "Transferência" },
  { value: "conta_corrente", label: "Conta-corrente" },
  { value: "cheque", label: "Cheque" },
  { value: "outro", label: "Outro" },
] as const;

export function metodoLabel(v: string): string {
  return METODOS_PAGAMENTO.find((m) => m.value === v)?.label ?? v;
}
