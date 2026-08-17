import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
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
import { eur } from "@/lib/format";

const LIMITE = 6;

export interface ItemCatalogo {
  id: string;
  nome: string;
  codigo?: string | null;
  tipo?: string;
  preco: number | string;
  preco2?: number | string;
  ativo?: boolean;
}

/**
 * Selector de artigos com pesquisa por código ou nome (prático com catálogos grandes).
 * Se `value` não for passado, funciona em modo "adicionar" (limpa após escolher).
 */
export function PickerCatalogo({
  itens,
  value,
  onSelect,
  placeholder = "Pesquisar artigo (código ou nome)…",
  triggerLabel,
  className,
  extraOption,
}: {
  itens: ItemCatalogo[];
  value?: string | null;
  onSelect: (item: ItemCatalogo | null) => void;
  placeholder?: string;
  triggerLabel?: string;
  className?: string;
  /** Opção adicional no topo, ex: item livre. */
  extraOption?: { label: string; onSelect: () => void; selected?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ativos = useMemo(() => itens.filter((i) => i.ativo !== false), [itens]);
  const selecionado = value ? itens.find((i) => i.id === value) : undefined;

  const termo = busca.toLowerCase().trim();
  const encontrados = useMemo(() => {
    if (!termo) return ativos.slice(0, LIMITE);
    return ativos.filter((i) =>
      `${i.codigo ?? ""} ${i.nome}`.toLowerCase().includes(termo),
    );
  }, [ativos, termo]);
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
          className={`justify-between font-normal ${className ?? "w-[260px]"}`}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selecionado
                ? `${selecionado.codigo ? `${selecionado.codigo} · ` : ""}${selecionado.nome}`
                : (triggerLabel ?? "Adicionar do catálogo…")}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>Sem artigos correspondentes.</CommandEmpty>
            {extraOption && (
              <CommandGroup>
                <CommandItem
                  value={extraOption.label}
                  onSelect={() => {
                    extraOption.onSelect();
                    setOpen(false);
                  }}
                >
                  {extraOption.selected && <Check className="mr-2 h-4 w-4" />}
                  {extraOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={termo ? "Resultados" : "Mais usados"}>
              {visiveis.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  onSelect={() => {
                    onSelect(i);
                    setBusca("");
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {i.codigo && <span className="mono text-xs text-muted-foreground">{i.codigo}</span>}
                    <span className="truncate">{i.nome}</span>
                  </span>
                  <span className="mono ml-2 text-xs text-muted-foreground">{eur(Number(i.preco))}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {restantes > 0
                ? `+${restantes} artigos — escreve o código ou nome para refinar.`
                : termo
                  ? `${encontrados.length} resultado(s).`
                  : `${ativos.length} artigos no catálogo — escreve para pesquisar.`}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
