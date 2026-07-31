import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pesquisaGlobal } from "@/lib/geral.functions";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { eur } from "@/lib/format";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useQuery({
    queryKey: ["pesquisa-global", debounced],
    queryFn: () => pesquisaGlobal({ data: { q: debounced } }),
    enabled: debounced.length >= 1,
  });

  const vazio = useMemo(
    () => data && data.clientes.length === 0 && data.registos.length === 0 && data.ordens.length === 0,
    [data],
  );

  function go(fn: () => void) {
    fn();
    setQ("");
    setOpen(false);
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Pesquisar nº venda, nº OS ou cliente…"
        className="h-8 pl-8"
      />
      {open && debounced.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {vazio && <div className="p-3 text-sm text-muted-foreground">Sem resultados.</div>}
          {data?.registos.length ? (
            <Group label="Vendas">
              {data.registos.map((r) => (
                <Row
                  key={r.id}
                  onClick={() => go(() => navigate({ to: "/registos/$id", params: { id: r.id } }))}
                  left={`#${r.numero}`}
                  right={eur(Number(r.total))}
                  sub={new Date(r.data).toLocaleDateString("pt-PT")}
                />
              ))}
            </Group>
          ) : null}
          {data?.ordens.length ? (
            <Group label="Ordens de serviço">
              {data.ordens.map((o) => (
                <Row
                  key={o.id}
                  onClick={() => go(() => navigate({ to: "/oficina/$id", params: { id: o.id } }))}
                  left={`#${o.numero}`}
                  right={o.status}
                  sub={o.cliente_nome ?? ""}
                />
              ))}
            </Group>
          ) : null}
          {data?.clientes.length ? (
            <Group label="Clientes">
              {data.clientes.map((c) => (
                <Row
                  key={c.id}
                  onClick={() => go(() => navigate({ to: "/clientes/$id", params: { id: c.id } }))}
                  left={c.nome}
                  sub={[c.nif, c.telefone].filter(Boolean).join(" · ")}
                />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-0">
      <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="py-1">{children}</div>
    </div>
  );
}

function Row({
  left,
  right,
  sub,
  onClick,
}: {
  left: string;
  right?: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span className="min-w-0 truncate">
        <span className="mono">{left}</span>
        {sub ? <span className="ml-2 text-xs text-muted-foreground">{sub}</span> : null}
      </span>
      {right ? <span className="mono text-xs text-muted-foreground">{right}</span> : null}
    </button>
  );
}
