import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getOS,
  atualizarOS,
  mudarStatusOS,
  adicionarItemOS,
  removerItemOS,
  entregarOS,
  assinarRececao,
  uploadAnexoOS,
  removerAnexoOS,
  STATUS_OS,
  type StatusOS,
} from "@/lib/oficina.functions";
import { listCatalogo } from "@/lib/admin.functions";
import { StatusBadgeOS } from "@/components/StatusBadgeOS";
import { SignaturePad } from "@/components/SignaturePad";
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
import { Plus, Trash2, Printer, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_app/oficina/$id")({
  head: () => ({ meta: [{ title: "Ordem de serviço — VRCF" }] }),
  component: OSDetalhePage,
});

const CHECKLIST_ITENS: { key: string; label: string }[] = [
  { key: "liga", label: "Equipamento liga" },
  { key: "ecra_ok", label: "Ecrã sem defeitos visíveis" },
  { key: "teclado_ok", label: "Teclado / rato funcionais" },
  { key: "bateria_ok", label: "Bateria a carregar" },
  { key: "wifi_ok", label: "Wi-Fi / rede a funcionar" },
  { key: "carcaca_ok", label: "Carcaça sem danos" },
];

const STATUS_LABELS: Record<StatusOS, string> = {
  rececionado: "Rececionado",
  em_diagnostico: "Em diagnóstico",
  aguardar_aprovacao: "Aguarda aprovação",
  aprovado: "Aprovado",
  em_reparacao: "Em reparação",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const METODOS = [
  { v: "dinheiro", label: "Dinheiro" },
  { v: "mb", label: "Multibanco" },
  { v: "transferencia", label: "Transferência" },
  { v: "conta_corrente", label: "Conta-corrente" },
  { v: "cheque", label: "Cheque" },
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

  const atualizar = useServerFn(atualizarOS);
  const mudarStatus = useServerFn(mudarStatusOS);
  const addItem = useServerFn(adicionarItemOS);
  const delItem = useServerFn(removerItemOS);
  const entregar = useServerFn(entregarOS);
  const assinarRec = useServerFn(assinarRececao);
  const uploadAnexo = useServerFn(uploadAnexoOS);
  const removerAnexo = useServerFn(removerAnexoOS);

  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [assinaturaRececao, setAssinaturaRececao] = useState<string | null>(null);
  const [assinaturaEntrega, setAssinaturaEntrega] = useState<string | null>(null);
  const [limpeza, setLimpeza] = useState(false);
  const [testes, setTestes] = useState(false);
  const [metodoPag, setMetodoPag] = useState<(typeof METODOS)[number]["v"]>("dinheiro");
  const [novoItemCatalogo, setNovoItemCatalogo] = useState<string>("_livre");
  const [novaDesc, setNovaDesc] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  const [novoPreco, setNovoPreco] = useState("0");
  const [aEnviar, setAEnviar] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["os", id] });

  const statusM = useMutation({
    mutationFn: (status: StatusOS) => mudarStatus({ data: { id, status } }),
    onSuccess: invalidate,
  });

  const relatorioM = useMutation({
    mutationFn: () => atualizar({ data: { id, relatorio_intervencao: relatorio ?? undefined } }),
    onSuccess: invalidate,
  });

  const checklistM = useMutation({
    mutationFn: (checklist: Record<string, boolean>) => atualizar({ data: { id, checklist } }),
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
    onSuccess: () => {
      setNovaDesc("");
      setNovaQtd("1");
      setNovoPreco("0");
      setNovoItemCatalogo("_livre");
      invalidate();
    },
  });

  const delItemM = useMutation({
    mutationFn: (itemId: string) => delItem({ data: { id: itemId } }),
    onSuccess: invalidate,
  });

  const assinarRecM = useMutation({
    mutationFn: () => assinarRec({ data: { id, assinatura_rececao: assinaturaRececao ?? "" } }),
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
    mutationFn: (path: string) => removerAnexo({ data: { work_order_id: id, path } }),
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
          metodo_pagamento: metodoPag,
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

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">A carregar…</p>;

  const { os, itens } = data;
  const checklist = (os.checklist ?? {}) as Record<string, boolean>;
  const jaEntregue = os.status === "entregue";
  const podeEntregar = itens.length === 0 || total === 0 ? true : !!assinaturaEntrega;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">OS #{os.numero}</h1>
            <StatusBadgeOS status={os.status as StatusOS} />
          </div>
          <p className="text-sm text-muted-foreground">
            {os.cliente_nome} · {os.equipamento} {os.marca_modelo ? `· ${os.marca_modelo}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/oficina/$id/imprimir" params={{ id }} target="_blank">
              <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
            </Link>
          </Button>
          {!jaEntregue && (
            <Select value={os.status} onValueChange={(v) => statusM.mutate(v as StatusOS)}>
              <SelectTrigger className="w-48">
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
          <CardTitle className="text-base">Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Contacto: </span>
            {os.contacto ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Nº série: </span>
            {os.num_serie ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Receção: </span>
            {dt(os.data_rececao)}
          </div>
          <div>
            <span className="text-muted-foreground">Valor estimado: </span>
            {os.valor_estimado ? eur(os.valor_estimado) : "—"}
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Sintomas descritos: </span>
            {os.sintomas_cliente ?? "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura na receção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SignaturePad
            value={assinaturaRececao ?? (os.assinatura_rececao as string | null)}
            onChange={setAssinaturaRececao}
            disabled={jaEntregue}
          />
          {!jaEntregue && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => assinarRecM.mutate()}
                disabled={assinaturaRececao === null || assinarRecM.isPending}
              >
                Guardar assinatura
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anexos / fotos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {((os.anexos as string[] | null) ?? []).map((url) => (
              <div key={url} className="relative group">
                <img src={url} alt="Anexo" className="h-24 w-full object-cover rounded-md border border-border" />
                {!jaEntregue && (
                  <button
                    onClick={() => removerAnexoM.mutate(url)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!jaEntregue && (
            <div>
              <Label htmlFor="upload-anexo" className="inline-flex">
                <Button type="button" variant="outline" size="sm" disabled={aEnviar} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" /> {aEnviar ? "A enviar…" : "Adicionar fotos"}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {CHECKLIST_ITENS.map((it) => (
            <label key={it.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!checklist[it.key]}
                disabled={jaEntregue}
                onCheckedChange={(v) => checklistM.mutate({ ...checklist, [it.key]: !!v })}
              />
              {it.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnóstico técnico / relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={4}
            disabled={jaEntregue}
            defaultValue={os.relatorio_intervencao ?? ""}
            onChange={(e) => setRelatorio(e.target.value)}
            placeholder="Descrição da intervenção, peças substituídas, testes efetuados…"
          />
          {!jaEntregue && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => relatorioM.mutate()} disabled={relatorio === null}>
                Guardar relatório
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orçamento — peças e serviços</CardTitle>
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
                  {!jaEntregue && <TableHead className="w-10" />}
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
                    {!jaEntregue && (
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

          {!jaEntregue && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Do catálogo</Label>
                <Select value={novoItemCatalogo} onValueChange={setNovoItemCatalogo}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Item livre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_livre">Item livre (texto)</SelectItem>
                    {catalogo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} — {eur(c.preco)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </CardContent>
      </Card>

      {!jaEntregue ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={limpeza} onCheckedChange={(v) => setLimpeza(!!v)} />
                Limpeza interna efetuada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={testes} onCheckedChange={(v) => setTestes(!!v)} />
                Testes finais OK
              </label>
            </div>
            <div className="space-y-2">
              <Label>Assinatura do cliente na entrega</Label>
              <SignaturePad value={assinaturaEntrega} onChange={setAssinaturaEntrega} />
            </div>
            {itens.length > 0 && total > 0 && (
              <div className="space-y-2">
                <Label>Método de pagamento</Label>
                <Select value={metodoPag} onValueChange={(v) => setMetodoPag(v as typeof metodoPag)}>
                  <SelectTrigger className="w-56">
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
              </div>
            )}

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
            <CardTitle className="text-base">Entregue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Entregue em {dt(os.data_entrega)}.</p>
            {os.assinatura_entrega && (
              <img src={os.assinatura_entrega} alt="Assinatura" className="h-24 rounded-md border border-border bg-white" />
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
