import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Save, Check, User, Stethoscope, ClipboardList, Camera, Upload, X, PenLine } from "lucide-react";
import {
  criarOS,
  uploadAnexoOS,
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
import { SignaturePad } from "@/components/SignaturePad";
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
  assinatura: string;
}

/** Reduz e comprime a foto antes de a guardar como anexo. */
function ficheiroParaDataUrlReduzido(file: File, maxDim = 1600, qualidade = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro a ler o ficheiro."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ficheiro de imagem inválido."));
      img.onload = () => {
        const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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
  const enviarAnexo = useServerFn(uploadAnexoOS);

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
  const [assinatura, setAssinatura] = useState("");
  // Fotos tiradas na receção (ex: dobradiça partida) — enviadas ao criar a OS.
  const [fotos, setFotos] = useState<{ nome: string; dataUrl: string }[]>([]);
  const [aProcessarFotos, setAProcessarFotos] = useState(false);
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
        setAssinatura(d.assinatura ?? "");
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
      assinatura,
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
    marcaModelo, numSerie, pin, sintomas, checklist, acessorios, assinatura,
  ]);

  function limparRascunho() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignora */
    }
  }

  async function adicionarFotos(files: FileList) {
    setAProcessarFotos(true);
    try {
      const novas: { nome: string; dataUrl: string }[] = [];
      for (const file of Array.from(files)) {
        novas.push({ nome: file.name || `foto-${Date.now()}.jpg`, dataUrl: await ficheiroParaDataUrlReduzido(file) });
      }
      setFotos((prev) => [...prev, ...novas]);
    } catch {
      /* ficheiro inválido — ignora */
    } finally {
      setAProcessarFotos(false);
    }
  }

  const m = useMutation({
    mutationFn: async () => {
      const r = await criar({
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
          assinatura_rececao: assinatura || null,
        },
      });
      for (const f of fotos) {
        await enviarAnexo({ data: { work_order_id: r.id, nome_ficheiro: f.nome, data_url: f.dataUrl } });
      }
      return r;
    },
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
    assinatura.trim().length > 0 &&
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
              setAssinatura("");
            }}
          >
            Começar em branco
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            <User className="h-4 w-4 text-primary" /> Dados do cliente e equipamento
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            <Stethoscope className="h-4 w-4 text-primary" /> Diagnóstico inicial
            <BotaoGuardar onGuardar={guardarRascunho} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sintomas relatados pelo cliente *</Label>
            <Textarea rows={3} value={sintomas} onChange={(e) => setSintomas(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            <ClipboardList className="h-4 w-4 text-primary" /> Checklist de entrada
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

          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Fotos da receção</Label>
            <p className="text-xs text-muted-foreground">
              Registe danos visíveis na entrada (ex: dobradiça partida, ecrã riscado).
            </p>
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {fotos.map((f, i) => (
                  <div key={`${f.nome}-${i}`} className="relative group">
                    <img
                      src={f.dataUrl}
                      alt={f.nome}
                      className="h-24 w-full object-cover rounded-md border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="nova-os-ficheiros" className="inline-flex">
                <Button type="button" variant="outline" size="sm" disabled={aProcessarFotos} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {aProcessarFotos ? "A processar…" : "Adicionar fotos"}
                  </span>
                </Button>
              </Label>
              <input
                id="nova-os-ficheiros"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && adicionarFotos(e.target.files)}
              />
              <Label htmlFor="nova-os-camara" className="inline-flex">
                <Button type="button" variant="outline" size="sm" disabled={aProcessarFotos} asChild>
                  <span>
                    <Camera className="h-4 w-4 mr-1" /> Tirar foto
                  </span>
                </Button>
              </Label>
              <input
                id="nova-os-camara"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files && adicionarFotos(e.target.files)}
              />
              <span className="text-xs text-muted-foreground">Imagens comprimidas automaticamente.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            <PenLine className="h-4 w-4 text-primary" /> Assinatura do cliente
            <BotaoGuardar onGuardar={guardarRascunho} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad
            label="Assinatura do cliente (aceitação de termos) *"
            value={assinatura}
            onChange={setAssinatura}
          />
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
