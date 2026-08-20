import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getOS,
  atualizarOS,
  mudarStatusOS,
  adicionarItemOS,
  removerItemOS,
  entregarOS,
  uploadAnexoOS,
  removerAnexoOS,
  STATUS_OS,
  STATUS_LABELS,
  STATUS_ORDER,
  DEFAULT_CHECKLIST,
  ACESSORIOS_OPTIONS,
  MEIO_APROVACAO_OPTIONS,
  type StatusOS,
  type ChecklistItem,
  type CheckStatus,
} from "@/lib/oficina.functions";
import { listCatalogo, getCompany } from "@/lib/admin.functions";
import { generatePdfOS, type PDFType, type OSParaPdf } from "@/lib/generatePdfOS";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadgeOS } from "@/components/StatusBadgeOS";
import { SignaturePad } from "@/components/SignaturePad";
import { PickerCatalogo } from "@/components/PickerCatalogo";
import { eur, dt } from "@/lib/format";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, Upload, X, Paperclip, FileDown, ChevronDown, User, Stethoscope,
  ClipboardList, Wrench, Euro, FileText, MessageSquare, Images, PackageCheck, Camera,
} from "lucide-react";

export const Route = createFileRoute("/_app/oficina/$id/")({
  head: () => ({ meta: [{ title: "Ordem de serviço — VRCF" }] }),
  component: OSDetalhePage,
});

const METODOS = [
  { v: "dinheiro", label: "Dinheiro" },
  { v: "mb", label: "Multibanco" },
  { v: "transferencia", label: "Transferência" },
  { v: "conta_corrente", label: "Conta-corrente" },
  { v: "cheque", label: "Cheque" },
  { v: "encontro_contas", label: "Encontro de contas" },
  { v: "outro", label: "Outro" },

] as const;

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
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function OSDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["os", id], queryFn: () => getOS({ data: { id } }) });
  const { data: catalogo = [] } = useQuery({ queryKey: ["catalogo"], queryFn: () => listCatalogo() });
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => getCompany() });
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [editando, setEditando] = useState(false);

  const atualizar = useServerFn(atualizarOS);
  const mudarStatus = useServerFn(mudarStatusOS);
  const addItem = useServerFn(adicionarItemOS);
  const delItem = useServerFn(removerItemOS);
  const entregar = useServerFn(entregarOS);
  const uploadAnexo = useServerFn(uploadAnexoOS);
  const removerAnexo = useServerFn(removerAnexoOS);

  const [assinaturaRececao, setAssinaturaRececao] = useState<string | null>(null);
  const [assinaturaEntrega, setAssinaturaEntrega] = useState<string | null>(null);
  const [limpeza, setLimpeza] = useState(false);
  const [testes, setTestes] = useState(false);
  const [valorTotalPagoStr, setValorTotalPagoStr] = useState<string | null>(null);
  const [metodoPag, setMetodoPag] = useState<(typeof METODOS)[number]["v"]>("dinheiro");
  const [notaPag, setNotaPag] = useState("");

  const [novoItemCatalogo, setNovoItemCatalogo] = useState<string>("_livre");
  const [novaDesc, setNovaDesc] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  const [novoPreco, setNovoPreco] = useState("0");
  const [aEnviar, setAEnviar] = useState(false);
  const [acessorioOutro, setAcessorioOutro] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["os", id] });

  function avisarAuto(r: { status_auto?: string; aviso?: string } | undefined) {
    if (r?.status_auto) {
      toast.success(`Estado atualizado automaticamente para "${STATUS_LABELS[r.status_auto as StatusOS]}".`);
    }
    if (r?.aviso === "checklist_incompleto") {
      toast.warning("Dados guardados, mas o checklist de entrada tem de estar completo para o estado avançar.");
    }
  }

  const statusM = useMutation({
    mutationFn: (novoStatus: StatusOS) => {
      const oldIdx = STATUS_ORDER.indexOf(data!.os.status as StatusOS);
      const newIdx = STATUS_ORDER.indexOf(novoStatus);
      const locked = newIdx < oldIdx ? true : !!data!.os.auto_status_locked;
      return mudarStatus({ data: { id, status: novoStatus, auto_status_locked: locked } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const campoM = useMutation({
    mutationFn: (campo: Record<string, unknown>) => atualizar({ data: { id, ...campo } }),
    onSuccess: (r) => {
      avisarAuto(r as never);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assinarRecM = useMutation({
    mutationFn: () => atualizar({ data: { id, assinatura_rececao: assinaturaRececao ?? "" } }),
    onSuccess: invalidate,
  });

  const addItemM = useMutation({
    mutationFn: () => {
      const doCatalogo = catalogo.find((c) => c.id === novoItemCatalogo);
      return addItem({
        data: {
          work_order_id: id,
          catalogo_id: doCatalogo ? doCatalogo.id : null,
          descricao: doCatalogo ? doCatalogo.nome : novaDesc,
          quantidade: Number(novaQtd),
          preco_unitario: doCatalogo ? Number(doCatalogo.preco) : Number(novoPreco),
        },
      });
    },
    onSuccess: (r) => {
      setNovaDesc("");
      setNovaQtd("1");
      setNovoPreco("0");
      setNovoItemCatalogo("_livre");
      avisarAuto(r as never);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const delItemM = useMutation({
    mutationFn: (itemId: string) => delItem({ data: { id: itemId } }),
    onSuccess: invalidate,
  });

  const uploadAnexoM = useMutation({
    mutationFn: async (files: FileList) => {
      setAEnviar(true);
      try {
        for (const file of Array.from(files)) {
          const dataUrl = await ficheiroParaDataUrlReduzido(file);
          await uploadAnexo({ data: { work_order_id: id, nome_ficheiro: file.name, data_url: dataUrl } });
        }
      } finally {
        setAEnviar(false);
      }
    },
    onSuccess: invalidate,
  });

  const removerAnexoM = useMutation({
    mutationFn: (anexoId: string) => removerAnexo({ data: { work_order_id: id, anexo_id: anexoId } }),
    onSuccess: invalidate,
  });

  const entregarM = useMutation({
    mutationFn: () =>
      entregar({
        data: {
          id,
          assinatura_entrega: assinaturaEntrega ?? "",
          limpeza_efetuada: limpeza,
          testes_finais_ok: testes,
          valor_total_pago: valorTotalPagoStr ? Number(valorTotalPagoStr) : null,
          metodo_pagamento: metodoPag,
          nota_pagamento: notaPag.trim() || null,

        },
      }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["registos"] });
    },
  });

  const total = useMemo(
    () =>
      (data?.itens ?? []).reduce(
        (s, it) => s + Math.round(Number(it.quantidade) * Number(it.preco_unitario) * 100) / 100,
        0,
      ),
    [data?.itens],
  );

  async function gerarPdf(tipo: PDFType) {
    if (!data) return;
    setGerandoPdf(true);
    try {
      // Igual ao original: gerar o PDF de orçamento avança automaticamente
      // para "Orçamento Enviado" se ainda estiver numa fase inicial e não estiver travado.
      if (
        tipo === "orcamento" &&
        data.itens.length > 0 &&
        ["recebido", "diagnostico"].includes(data.os.status) &&
        !data.os.auto_status_locked
      ) {
        await statusM.mutateAsync("orcamento");
      }
      await generatePdfOS(
        data.os as unknown as OSParaPdf,
        data.itens,
        data.anexos,
        empresa ?? {},
        tipo,
      );
    } catch (e) {
      alert((e as Error).message ?? "Erro ao gerar PDF.");
    } finally {
      setGerandoPdf(false);
    }
  }



  if (isLoading || !data) return <p className="text-sm text-muted-foreground">A carregar…</p>;

  const { os, itens, anexos } = data;
  const checklist: ChecklistItem[] =
    Array.isArray(os.checklist) && os.checklist.length > 0
      ? (os.checklist as unknown as ChecklistItem[])
      : DEFAULT_CHECKLIST;
  const acessoriosAtuais: string[] = (os.acessorios as string[] | null) ?? [];
  const acessoriosConhecidos = acessoriosAtuais.filter((a) => (ACESSORIOS_OPTIONS as readonly string[]).includes(a));
  const acessoriosOutros = acessoriosAtuais.filter((a) => !(ACESSORIOS_OPTIONS as readonly string[]).includes(a));
  const checklistIncompleto = checklist.some((it) => it.status === null || it.status === undefined);
  const dadosIncompletos =
    !os.cliente_rapido &&
    (!os.contacto?.trim() || !os.equipamento?.trim() || !os.marca_modelo?.trim());
  const jaEntregue = os.status === "entregue";
  const bloqueado = jaEntregue || !editando;
  const podeEntregar =
    itens.length === 0 || total === 0
      ? true
      : !!assinaturaEntrega &&
        (metodoPag !== "encontro_contas" || notaPag.trim().length >= 3);


  function guardarChecklist(novoChecklist: ChecklistItem[]) {
    campoM.mutate({ checklist: novoChecklist });
  }

  function toggleAcessorio(acc: string) {
    const novos = acessoriosConhecidos.includes(acc)
      ? acessoriosConhecidos.filter((a) => a !== acc)
      : [...acessoriosConhecidos, acc];
    campoM.mutate({ acessorios: [...novos, ...acessoriosOutros] });
  }

  function guardarOutros(valor: string) {
    const lista = valor.split(",").map((s) => s.trim()).filter(Boolean);
    campoM.mutate({ acessorios: [...acessoriosConhecidos, ...lista] });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">OS #{os.numero}</h1>
            <StatusBadgeOS status={os.status as StatusOS} />
            {os.auto_status_locked && (
              <span className="text-xs text-muted-foreground italic">Auto-estado desativado</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {os.cliente_nome} · {os.equipamento} {os.marca_modelo ? `· ${os.marca_modelo}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={gerandoPdf}>
                <FileDown className="h-4 w-4 mr-1" /> {gerandoPdf ? "A gerar…" : "PDF"} <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => gerarPdf("diagnostico")}>📋 Receção / Diagnóstico</DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarPdf("orcamento")}>💰 Orçamento</DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarPdf("completo")}>📄 Completo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => gerarPdf("full")}>📦 Full (com anexos)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!jaEntregue && (
            <Button
              size="sm"
              variant={editando ? "default" : "outline"}
              onClick={() => setEditando((v) => !v)}
            >
              {editando ? "Concluir edição" : "Editar"}
            </Button>
          )}
          {!jaEntregue && (

            <Select value={os.status} onValueChange={(v) => statusM.mutate(v as StatusOS)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OS.filter((s) => s !== "entregue").map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Dados do cliente e equipamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!bloqueado && (
            <p className="text-xs text-muted-foreground">
              Corrija os dados e clique fora do campo para guardar.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["cliente_nome", "Nome do cliente", os.cliente_nome ?? ""],
              ["contacto", "Contacto", os.contacto ?? ""],
              ["equipamento", "Equipamento", os.equipamento ?? ""],
              ["marca_modelo", "Marca / modelo", os.marca_modelo ?? ""],
              ["num_serie", "Nº de série", os.num_serie ?? ""],
              ["password_pin", "Password / PIN", os.password_pin ?? ""],
            ] as const).map(([campo, label, valor]) => (
              <div className="space-y-1.5" key={campo}>
                <Label>{label}</Label>
                <Input
                  key={`${campo}-${valor}`}
                  disabled={bloqueado}
                  defaultValue={valor}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === valor) return;
                    if (campo === "cliente_nome" && !v) {
                      toast.error("O nome do cliente é obrigatório.");
                      e.target.value = valor;
                      return;
                    }
                    campoM.mutate({ [campo]: v || null });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Receção: </span>
              {dt(os.data_rececao)}
            </div>
            <div>
              <span className="text-muted-foreground">Cliente rápido: </span>
              {os.cliente_rapido ? "Sim" : "Não"}
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Diagnóstico inicial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sintomas relatados pelo cliente</Label>
            <Textarea
              rows={3}
              disabled={bloqueado}
              defaultValue={os.sintomas_cliente ?? ""}
              onBlur={(e) => campoM.mutate({ sintomas_cliente: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <SignaturePad
              label="Assinatura do cliente (aceitação de termos)"
              value={assinaturaRececao ?? (os.assinatura_rececao as string | null)}
              onChange={setAssinaturaRececao}
              onSave={() => assinarRecM.mutate()}
              disabled={bloqueado}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Checklist de entrada</CardTitle>
          {checklistIncompleto && dadosIncompletos && (
            <p className="text-xs text-destructive">
              Dados do cliente/equipamento incompletos: preencha todos os itens do checklist para o estado poder avançar.
            </p>
          )}
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
                      disabled={bloqueado}
                      onClick={() => {
                        const novo = checklist.map((it, idx) =>
                          idx === i ? { ...it, status: it.status === s ? null : s } : it,
                        );
                        guardarChecklist(novo);
                      }}
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
                  disabled={bloqueado}
                  defaultValue={item.notas}
                  onBlur={(e) => {
                    const novo = checklist.map((it, idx) => (idx === i ? { ...it, notas: e.target.value } : it));
                    guardarChecklist(novo);
                  }}
                />
              </div>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Acessórios entregues</Label>
            <div className="flex flex-wrap gap-3">
              {ACESSORIOS_OPTIONS.map((acc) => (
                <label key={acc} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={acessoriosConhecidos.includes(acc)}
                    disabled={bloqueado}
                    onCheckedChange={() => toggleAcessorio(acc)}
                  />
                  {acc}
                </label>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Outro(s)</Label>
              <Input
                placeholder="Ex: Disco externo, Pen USB…"
                disabled={bloqueado}
                defaultValue={acessorioOutro ?? acessoriosOutros.join(", ")}
                onChange={(e) => setAcessorioOutro(e.target.value)}
                onBlur={(e) => guardarOutros(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Diagnóstico técnico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Verificação técnica</Label>
            <Textarea
              rows={4}
              disabled={bloqueado}
              defaultValue={os.diagnostico_tecnico ?? ""}
              onBlur={(e) => campoM.mutate({ diagnostico_tecnico: e.target.value })}
              placeholder="Resultado da verificação técnica antes de enviar orçamento…"
            />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Data do diagnóstico</Label>
            <Input
              type="date"
              disabled={bloqueado}
              defaultValue={os.data_diagnostico ? String(os.data_diagnostico).slice(0, 10) : ""}
              onChange={(e) =>
                campoM.mutate({ data_diagnostico: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Euro className="h-4 w-4 text-primary" /> Orçamento e autorização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24 text-right">Qtd.</TableHead>
                  <TableHead className="w-28 text-right">Preço</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                  {!bloqueado && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Sem itens adicionados.
                    </TableCell>
                  </TableRow>
                )}
                {itens.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.descricao}</TableCell>
                    <TableCell className="text-right">{it.quantidade}</TableCell>
                    <TableCell className="text-right">{eur(it.preco_unitario)}</TableCell>
                    <TableCell className="text-right">{eur(it.subtotal)}</TableCell>
                    {!bloqueado && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => delItemM.mutate(it.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!bloqueado && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Do catálogo</Label>
                <PickerCatalogo
                  itens={catalogo}
                  value={novoItemCatalogo === "_livre" ? null : novoItemCatalogo}
                  onSelect={(i) => setNovoItemCatalogo(i ? i.id : "_livre")}
                  triggerLabel="Item livre (texto)"
                  className="w-56"
                  extraOption={{
                    label: "Item livre (texto)",
                    onSelect: () => setNovoItemCatalogo("_livre"),
                    selected: novoItemCatalogo === "_livre",
                  }}
                />
              </div>

              {novoItemCatalogo === "_livre" && (
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} className="w-48" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Qtd.</Label>
                <Input
                  type="number"
                  min={0.001}
                  step="1"
                  value={novaQtd}
                  onChange={(e) => setNovaQtd(e.target.value)}
                  className="w-20"
                />
              </div>
              {novoItemCatalogo === "_livre" && (
                <div className="space-y-1">
                  <Label className="text-xs">Preço (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={novoPreco}
                    onChange={(e) => setNovoPreco(e.target.value)}
                    className="w-24"
                  />
                </div>
              )}
              <Button
                size="sm"
                onClick={() => addItemM.mutate()}
                disabled={novoItemCatalogo === "_livre" && !novaDesc.trim()}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          )}

          <div className="flex justify-end text-sm font-medium pt-2 border-t border-border">
            Total: {eur(total)}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label>Aprovado por</Label>
              <Input
                disabled={bloqueado}
                defaultValue={os.aprovado_por ?? ""}
                onBlur={(e) => campoM.mutate({ aprovado_por: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Meio</Label>
                <Select
                  value={os.meio_aprovacao ?? ""}
                  onValueChange={(v) => campoM.mutate({ meio_aprovacao: v })}
                  disabled={bloqueado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEIO_APROVACAO_OPTIONS.map((m) => (
                      <SelectItem key={m.v} value={m.v}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  disabled={bloqueado}
                  defaultValue={os.data_aprovacao ? os.data_aprovacao.slice(0, 10) : ""}
                  onBlur={(e) => campoM.mutate({ data_aprovacao: e.target.value || null })}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Prazo estimado de entrega</Label>
            <Input
              type="date"
              disabled={bloqueado}
              defaultValue={os.prazo_estimado ? os.prazo_estimado.slice(0, 10) : ""}
              onBlur={(e) => campoM.mutate({ prazo_estimado: e.target.value || null })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Relatório de intervenção</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            disabled={bloqueado}
            defaultValue={os.relatorio_intervencao ?? ""}
            onBlur={(e) => campoM.mutate({ relatorio_intervencao: e.target.value })}
            placeholder="Descrição da intervenção, peças substituídas, testes efetuados…"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={3}
            disabled={bloqueado}
            defaultValue={os.observacoes ?? ""}
            onBlur={(e) => campoM.mutate({ observacoes: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={!!os.observacoes_incluir_pdf}
              disabled={bloqueado}
              onCheckedChange={(v) => campoM.mutate({ observacoes_incluir_pdf: !!v })}
            />
            Incluir observações no PDF
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Images className="h-4 w-4 text-primary" /> Anexos / fotos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {anexos.map((a) => (
              <div key={a.id} className="relative group">
                {a.tipo?.startsWith("image/") && a.url ? (
                  <img src={a.url} alt={a.nome} className="h-24 w-full object-cover rounded-md border border-border" />
                ) : (
                  <a
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="h-24 w-full flex flex-col items-center justify-center gap-1 rounded-md border border-border text-xs text-muted-foreground p-1 text-center"
                  >
                    <Paperclip className="h-4 w-4" />
                    {a.nome}
                  </a>
                )}
                {!bloqueado && (
                  <button
                    onClick={() => removerAnexoM.mutate(a.id)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!bloqueado && (
            <div>
              <Label htmlFor="upload-anexo" className="inline-flex">
                <Button type="button" variant="outline" size="sm" disabled={aEnviar} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" /> {aEnviar ? "A enviar…" : "Adicionar ficheiros"}
                  </span>
                </Button>
              </Label>
              <input
                id="upload-anexo"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadAnexoM.mutate(e.target.files)}
              />
              <Label htmlFor="tirar-foto" className="inline-flex ml-2">
                <Button type="button" variant="outline" size="sm" disabled={aEnviar} asChild>
                  <span>
                    <Camera className="h-4 w-4 mr-1" /> Tirar foto
                  </span>
                </Button>
              </Label>
              <input
                id="tirar-foto"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files && uploadAnexoM.mutate(e.target.files)}
              />
              <span className="ml-2 text-xs text-muted-foreground">
                Imagens são comprimidas automaticamente.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!jaEntregue ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /> Controlo de qualidade e entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={limpeza} onCheckedChange={(v) => setLimpeza(!!v)} />
                Limpeza efetuada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={testes} onCheckedChange={(v) => setTestes(!!v)} />
                Testes finais OK
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor total pago (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={total ? total.toFixed(2) : "0.00"}
                  value={valorTotalPagoStr ?? ""}
                  onChange={(e) => setValorTotalPagoStr(e.target.value)}
                />
              </div>
              {itens.length > 0 && total > 0 && (
                <div className="space-y-2">
                  <Label>Método de pagamento (venda gerada na Loja)</Label>
                  <Select value={metodoPag} onValueChange={(v) => setMetodoPag(v as typeof metodoPag)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METODOS.map((m) => (
                        <SelectItem key={m.v} value={m.v}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {metodoPag === "encontro_contas" && (
                    <div className="space-y-1.5 rounded-md border bg-muted/40 p-2">
                      <Label className="text-xs">Motivo do encontro de contas *</Label>
                      <Textarea
                        rows={3}
                        placeholder="Descreva o que originou o encontro de contas…"
                        value={notaPag}
                        onChange={(e) => setNotaPag(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
            <div className="space-y-2">
              <SignaturePad
                label="Assinatura de levantamento (conforme)"
                value={assinaturaEntrega}
                onChange={setAssinaturaEntrega}
              />
            </div>

            {entregarM.isError && (
              <p className="text-sm text-destructive">{(entregarM.error as Error).message}</p>
            )}

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!podeEntregar}>Marcar como entregue</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar entrega</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm">
                        {itens.length > 0 && total > 0 ? (
                          <>
                            <p>
                              Vai ser criada uma venda na Loja com {itens.length}{" "}
                              {itens.length === 1 ? "item" : "itens"}, no valor de{" "}
                              <strong>{eur(total)}</strong>, paga por{" "}
                              {METODOS.find((m) => m.v === metodoPag)?.label.toLowerCase()}.
                            </p>
                            <ul className="list-disc pl-5">
                              {itens.map((it) => (
                                <li key={it.id}>
                                  {it.descricao} — {it.quantidade} × {eur(it.preco_unitario)}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p>Esta OS não tem itens de orçamento — a entrega não vai gerar venda na Loja.</p>
                        )}
                        <p>Esta ação não pode ser desfeita.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => entregarM.mutate()}>Confirmar entrega</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /> Entregue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Entregue em {dt(os.data_entrega)} · Valor pago: {eur(os.valor_total_pago ?? 0)}
            </p>
            {os.assinatura_entrega && (
              <img
                src={os.assinatura_entrega}
                alt="Assinatura"
                className="h-24 rounded-md border border-border bg-white"
              />
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/oficina" })}>
          ← Voltar às ordens de serviço
        </Button>
      </div>
    </div>
  );
}
