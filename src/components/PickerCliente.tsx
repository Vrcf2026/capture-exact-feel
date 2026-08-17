import { useMemo, useState } from "react";
import { ChevronsUpDown, List, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const LIMITE = 6;

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
  const [listaAberta, setListaAberta] = useState(false);
  const [buscaLista, setBuscaLista] = useState("");
  const selecionado = value ? clientes.find((c) => c.id === value) : undefined;

  const texto = (c: ClienteMin) =>
    `${c.nome} ${c.nif ?? ""} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase();

  const termo = busca.toLowerCase().trim();
  const encontrados = useMemo(() => {
    if (!termo) return clientes.slice(0, LIMITE);
    return clientes.filter((c) => texto(c).includes(termo));
  }, [clientes, termo]);
  const visiveis = encontrados.slice(0, LIMITE);
  const restantes = encontrados.length - visiveis.length;

  const termoLista = buscaLista.toLowerCase().trim();
  const listaCompleta = useMemo(() => {
    const base = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
    if (!termoLista) return base;
    return base.filter((c) => texto(c).includes(termoLista));
  }, [clientes, termoLista]);

  return (
    <>
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
              <div className="space-y-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <p>
                  {restantes > 0
                    ? `+${restantes} clientes — escreve nome, NIF ou telefone.`
                    : termo
                      ? `${encontrados.length} resultado(s).`
                      : `${clientes.length} clientes — escreve para pesquisar.`}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setBuscaLista(busca);
                    setOpen(false);
                    setListaAberta(true);
                  }}
                >
                  <List className="mr-2 h-4 w-4" />
                  Ver lista completa
                </Button>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" /> Lista de clientes
            </DialogTitle>
            <DialogDescription>
              {listaCompleta.length} cliente(s) — clica numa linha para escolher.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Filtrar por nome, NIF, telefone ou email…"
              value={buscaLista}
              onChange={(e) => setBuscaLista(e.target.value)}
            />
          </div>
          <div className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                onSelect(null);
                setBusca("");
                setBuscaLista("");
                setListaAberta(false);
              }}
            >
              {semClienteLabel}
            </button>
            {listaCompleta.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Sem clientes correspondentes.</p>
            )}
            {listaCompleta.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(c);
                  setBusca("");
                  setBuscaLista("");
                  setListaAberta(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <span className="shrink-0 truncate text-xs text-muted-foreground">
                  {[c.telefone, c.nif, c.email].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
