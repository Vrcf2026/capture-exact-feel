import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Save, Check } from "lucide-react";
import {
  criarOS,
  DEFAULT_CHECKLIST,
  ACESSORIOS_OPTIONS,
  type ChecklistItem,
  type CheckStatus,
} from "@/lib/oficina.functions";
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
  head: () => ({
    meta: [
      { title: "Nova ordem de serviço — VRCF Oficina" },
      {
        name: "description",
        content:
          "Receção de equipamento: dados do cliente, checklist de entrada e acessórios, com gravação automática do rascunho.",
      },
      { property: "og:title", content: "Nova ordem de serviço — VRCF Oficina" },
      {
        property: "og:description",
        content: "Registo de entrada de equipamento com checklist e autosave.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaOSPage,
});

const DRAFT_KEY = "vrcf:nova-os:rascunho";

interface Rascunho {
  clienteRapido: boolean;
  clienteId: string | null;
  clienteNome: string;
  contacto: string;
  equipamento: string;
  marcaModelo: string;
  numSerie: string;
  pin: string;
  sintomas: string;
  checklist: ChecklistItem[];
  acessorios: string[];
}

/** Botão "disquete": grava o rascunho deste quadro no dispositivo. */
function BotaoGuardar({ onGuardar }: { onGuardar: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="ml-auto h-7 gap-1.5 text-xs font-normal"
      title="Guardar rascunho deste quadro"
      onClick={() => {
        onGuardar();
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
      {ok ? "Guardado" : "Guardar"}
    </Button>
  );
}

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
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [acessorios, setAcessorios] = useState<string[]>([]);
  const [guardadoEm, setGuardadoEm] = useState<string | null>(null);
  const [restaurado, setRestaurado] = useState(false);

  const carregado = useRef(false);

  // Restaura rascunho guardado no dispositivo (autosave).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Rascunho;
        setClienteRapido(!!d.clienteRapido);
        setClienteId(d.clienteId ?? null);
        setClienteNome(d.clienteNome ?? "");
        setContacto(d.contacto ?? "");
        setEquipamento(d.equipamento ?? "");
        setMarcaModelo(d.marcaModelo ?? "");
        setNumSerie(d.numSerie ?? "");
        setPin(d.pin ?? "");
        setSintomas(d.sintomas ?? "");
        if (Array.isArray(d.checklist) && d.checklist.length > 0) setChecklist(d.checklist);
        if (Array.isArray(d.acessorios)) setAcessorios(d.acessorios);
        setRestaurado(true);
      }
    } catch {
      /* rascunho inválido — ignora */
    }
    carregado.current = true;
  }, []);

  function guardarRascunho() {
    const d: Rascunho = {
      clienteRapido,
      clienteId,
      clienteNome,
      contacto,
      equipamento,
      marcaModelo,
      numSerie,
      pin,
      sintomas,
      checklist,
      acessorios,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      setGuardadoEm(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      /* armazenamento indisponível */
    }
  }

  // Autosave: 1 segundo depois de qualquer alteração.
  useEffect(() => {
    if (!carregado.current) return;
    const t = setTimeout(guardarRascunho, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clienteRapido, clienteId, clienteNome, contacto, equipamento,
    marcaModelo, numSerie, pin, sintomas, checklist, acessorios,
  ]);

  function limparRascunho() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignora */
    }
  }

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
          checklist,
          acessorios,
        },
      }),
    onSuccess: (r) => {
      limparRascunho();
      navigate({ to: "/oficina/$id", params: { id: r.id } });
    },
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

  function toggleAcessorio(acc: string) {
    setAcessorios((prev) => (prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]));
  }

  // Mesma validação do vrcftecnica original: contacto só é obrigatório fora de "cliente rápido".
  const podeSubmeter =
    clienteNome.trim().length > 0 &&
    sintomas.trim().length > 0 &&
    (clienteRapido || contacto.trim().length > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova ordem de serviço</h1>
        <p className="text-sm text-muted-foreground">
          Receção de equipamento na oficina. Os dados são guardados automaticamente neste dispositivo.
        </p>
      </div>

      {restaurado && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex-1">Recuperámos um rascunho não submetido.</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              limparRascunho();
              setRestaurado(false);
              setClienteRapido(false);
              setClienteId(null);
              setClienteNome("");
              setContacto("");
              setEquipamento("");
              setMarcaModelo("");
              setNumSerie("");
              setPin("");
              setSintomas("");
              setChecklist(DEFAULT_CHECKLIST);
              setAcessorios([]);
            }}
          >
            Começar em branco
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            Cliente e equipamento
            <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground cursor-pointer">
              <Checkbox checked={clienteRapido} onCheckedChange={(v) => setClienteRapido(!!v)} />
              Cliente rápido
            </label>
            <BotaoGuardar onGuardar={guardarRascunho} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            Checklist de entrada
            <BotaoGuardar onGuardar={guardarRascunho} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            {checklist.map((item, i) => (
              <div key={item.item} className="border-b border-border/50 py-2">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm flex-1">{item.item}</span>
                  {(["ok", "defeito", "na"] as CheckStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setChecklist((prev) =>
                          prev.map((it, idx) => (idx === i ? { ...it, status: it.status === s ? null : s } : it)),
                        )
                      }
                      className={`w-7 h-7 rounded-md border text-xs font-bold flex-shrink-0 ${
                        item.status === s
                          ? s === "ok"
                            ? "bg-emerald-500/20 text-emerald-600 border-emerald-500"
                            : s === "defeito"
                              ? "bg-destructive/20 text-destructive border-destructive"
                              : "bg-muted text-muted-foreground border-border"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {s === "ok" ? "✓" : s === "defeito" ? "✗" : "—"}
                    </button>
                  ))}
                </div>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="Notas…"
                  value={item.notas}
                  onChange={(e) =>
                    setChecklist((prev) =>
                      prev.map((it, idx) => (idx === i ? { ...it, notas: e.target.value } : it)),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Acessórios entregues</Label>
            <div className="flex flex-wrap gap-3">
              {ACESSORIOS_OPTIONS.map((acc) => (
                <label key={acc} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={acessorios.includes(acc)} onCheckedChange={() => toggleAcessorio(acc)} />
                  {acc}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {m.isError && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}

      <div className="flex items-center justify-end gap-3">
        {guardadoEm && (
          <span className="text-xs text-muted-foreground mr-auto">Rascunho guardado às {guardadoEm}</span>
        )}
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
