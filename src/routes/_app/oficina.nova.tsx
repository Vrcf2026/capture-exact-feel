import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { criarOS, listTecnicos } from "@/lib/oficina.functions";
import { listClientes } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const { data: tecnicos = [] } = useQuery({ queryKey: ["tecnicos"], queryFn: () => listTecnicos() });
  const criar = useServerFn(criarOS);

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [contacto, setContacto] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [numSerie, setNumSerie] = useState("");
  const [pin, setPin] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [valorEstimado, setValorEstimado] = useState("");

  const m = useMutation({
    mutationFn: () =>
      criar({
        data: {
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          contacto: contacto || null,
          equipamento,
          marca_modelo: marcaModelo || null,
          num_serie: numSerie || null,
          password_pin: pin || null,
          sintomas_cliente: sintomas || null,
          acessorios: [],
          tecnico_id: tecnicoId,
          valor_estimado: valorEstimado ? Number(valorEstimado) : null,
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

  const podeSubmeter = clienteNome.trim().length > 0 && equipamento.trim().length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova ordem de serviço</h1>
        <p className="text-sm text-muted-foreground">Receção de equipamento na oficina.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente e equipamento</CardTitle>
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
              <Label>Nome do cliente *</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Equipamento *</Label>
              <Input
                placeholder="Ex: Portátil, Desktop, Impressora…"
                value={equipamento}
                onChange={(e) => setEquipamento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Marca / modelo</Label>
              <Input value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº de série</Label>
              <Input value={numSerie} onChange={(e) => setNumSerie(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password / PIN do equipamento</Label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sintomas descritos pelo cliente</Label>
            <Textarea rows={3} value={sintomas} onChange={(e) => setSintomas(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Técnico responsável</Label>
              <Select value={tecnicoId ?? "nenhum"} onValueChange={(v) => setTecnicoId(v === "nenhum" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Por atribuir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Por atribuir</SelectItem>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor estimado (€)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
              />
            </div>
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
