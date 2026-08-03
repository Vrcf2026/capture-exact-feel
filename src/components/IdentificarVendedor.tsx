import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { confirmarVendedorAcesso, listVendedores } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Popup obrigatório de identificação do vendedor — igual ao internal-sales-ledger
 * original: abre sozinho ao entrar na página, não deixa continuar sem confirmar
 * vendedor + PIN, e fica lembrado (para esta página) até se clicar em "Trocar".
 */
export function useVendedorObrigatorio() {
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);
  const [vendedorPin, setVendedorPin] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const { data: vendedores = [] } = useQuery({ queryKey: ["vendedores"], queryFn: () => listVendedores() });
  const confirmar = useServerFn(confirmarVendedorAcesso);

  const [selId, setSelId] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState(false);

  useEffect(() => {
    if (!vendedorId && vendedores.length > 0 && !selId) {
      setSelId(vendedores.find((v) => v.ativo)?.id ?? "");
    }
  }, [vendedores, vendedorId, selId]);

  async function confirmarAcesso() {
    if (!selId) {
      setErro("Escolha o vendedor.");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setErro("PIN inválido.");
      return;
    }
    setAConfirmar(true);
    setErro(null);
    try {
      const v = await confirmar({ data: { vendedor_id: selId, pin } });
      setVendedorId(v.id);
      setVendedorNome(v.nome);
      setVendedorPin(pin);
      setOpen(false);
      setPin("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAConfirmar(false);
    }
  }

  function trocarVendedor() {
    setSelId(vendedorId ?? "");
    setPin("");
    setErro(null);
    setOpen(true);
  }

  const dialog = (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >

        <DialogHeader>
          <DialogTitle>Identificar vendedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vendedor</Label>
            <Select value={selId} onValueChange={setSelId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.filter((v) => v.ativo).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && confirmarAcesso()}
            />
          </div>
          {vendedores.length === 0 && (
            <p className="text-sm text-destructive">Não existem vendedores ativos. Crie um em Vendedores.</p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={confirmarAcesso} disabled={aConfirmar || vendedores.length === 0} className="w-full">
            {aConfirmar ? "A confirmar…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { vendedorId, vendedorNome, vendedorPin, trocarVendedor, dialog, pronto: !!vendedorId && !!vendedorPin };
}
