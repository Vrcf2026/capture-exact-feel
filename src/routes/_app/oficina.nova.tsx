import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { criarOS } from "@/lib/oficina.functions";
import { listClientes } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/oficina/nova")({
  head: () => ({ meta: [{ title: "Nova OS — VRCF" }] }),
  component: NovaOSPage,
});

function NovaOSPage() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const criar = useServerFn(criarOS);

  const [clienteRapido, setClienteRapido] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [contacto, setContacto] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [numSerie, setNumSerie] = useState("");
  const [pin, setPin] = useState("");
  const [sintomas, setSintomas] = useState("");

  const m = useMutation({
    mutationFn: () =>
      criar({
        data: {
          cliente_rapido: clienteRapido,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          contacto: contacto || null,
          equipamento: equipamento || null,
          marca_modelo: marcaModelo || null,
          num_serie: numSerie || null,
          password_pin: pin || null,
          sintomas_cliente: sintomas || null,
        },
      }),
    onSuccess: (r) => navigate({ to: "/oficina/$id", params: { id: r.id } }),
  });

  function selecionarCliente(id: string) {
    if (id === "novo") {
      setClienteId(null);
      return;
    }
    const c = clientes.find((c) => c.id === id);
    setClienteId(id);
    if (c) {
      setClienteNome(c.nome ?? "");
      setContacto(c.telefone ?? "");
    }
  }

  // Mesma validação do vrcftecnica original: contacto e checklist só são
  // obrigatórios fora de "cliente rápido"; aqui só o obrigamos à entrada.
  const podeSubmeter =
    clienteNome.trim().length > 0 &&
    sintomas.trim().length > 0 &&
    (clienteRapido || contacto.trim().length > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova ordem de serviço</h1>
        <p className="text-sm text-muted-foreground">Receção de equipamento na oficina.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            Cliente e equipamento
            <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground cursor-pointer">
              <Checkbox checked={clienteRapido} onCheckedChange={(v) => setClienteRapido(!!v)} />
              Cliente rápido
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente existente (opcional)</Label>
            <Select value={clienteId ?? "novo"} onValueChange={selecionarCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente novo / avulso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Cliente novo / avulso</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto (Tel/Email){!clienteRapido && " *"}</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Equipamento</Label>
              <Input
                placeholder="Ex: Portátil, Desktop…"
                value={equipamento}
                onChange={(e) => setEquipamento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Marca/Modelo</Label>
              <Input value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº de Série</Label>
              <Input value={numSerie} onChange={(e) => setNumSerie(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password/PIN</Label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sintomas relatados pelo cliente *</Label>
            <Textarea rows={3} value={sintomas} onChange={(e) => setSintomas(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {m.isError && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/oficina" })}>
          Cancelar
        </Button>
        <Button disabled={!podeSubmeter || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "A criar…" : "Criar ordem de serviço"}
        </Button>
      </div>
    </div>
  );
}
