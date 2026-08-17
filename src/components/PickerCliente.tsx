import { useMemo, useState } from "react";

const LIMITE = 6;
import { ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ClienteMin {
  id: string;
  nome: string;
  nif?: string | null;
  telefone?: string | null;
  email?: string | null;
}

/** Selector de clientes com pesquisa por nome, NIF, telefone ou email. */
export function PickerCliente({
  clientes,
  value,
  onSelect,
  semClienteLabel = "Consumidor final",
  className,
}: {
  clientes: ClienteMin[];
  value: string | null;
  onSelect: (cliente: ClienteMin | null) => void;
  semClienteLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionado = value ? clientes.find((c) => c.id === value) : undefined;

  const termo = busca.toLowerCase().trim();
  const encontrados = useMemo(() => {
    if (!termo) return clientes.slice(0, LIMITE);
    return clientes.filter((c) =>
      `${c.nome} ${c.nif ?? ""} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(termo),
    );
  }, [clientes, termo]);
  const visiveis = encontrados.slice(0, LIMITE);
  const restantes = encontrados.length - visiveis.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between font-normal ${className ?? "w-full"}`}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selecionado ? selecionado.nome : semClienteLabel}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Pesquisar cliente (nome, NIF, telefone, email)…"
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            <CommandEmpty>Sem clientes correspondentes.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__sem_cliente__"
                onSelect={() => {
                  onSelect(null);
                  setBusca("");
                  setOpen(false);
                }}
              >
                {semClienteLabel}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading={termo ? "Resultados" : "Clientes"}>
              {visiveis.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onSelect(c);
                    setBusca("");
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {[c.telefone, c.nif].filter(Boolean).join(" · ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {restantes > 0
                ? `+${restantes} clientes — escreve nome, NIF ou telefone.`
                : termo
                  ? `${encontrados.length} resultado(s).`
                  : `${clientes.length} clientes — escreve para pesquisar.`}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
