import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  gerarBackupJson,
  resumoBackup,
  dadosTabela,
  dadosTodasTabelas,
  listarBackupsGuardados,
  linkBackupGuardado,
  correrBackupAgora,
} from "@/lib/backup.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  DatabaseBackup,
  FileSpreadsheet,
  HardDriveDownload,
  CloudUpload,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_app/backups")({
  head: () => ({
    meta: [
      { title: "Backups — VRCF" },
      { name: "description", content: "Exportar dados em JSON e CSV, backups diários e cópia para o Google Drive." },
      { property: "og:title", content: "Backups — VRCF" },
      { property: "og:description", content: "Cópias de segurança dos dados da loja e da oficina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupsPage,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-sm text-destructive">Não foi possível carregar os backups: {error.message}</p>
    </div>
  ),
});

const NOMES: Record<string, string> = {
  company_settings: "Empresa",
  utilizadores: "Utilizadores",
  vendedores: "Vendedores",
  clientes: "Clientes",
  catalogo: "Catálogo",
  stock_movimentos: "Movimentos de stock",
  caixa_diario: "Caixa diário",
  saidas_caixa: "Saídas de caixa",
  registos: "Vendas (registos)",
  registo_itens: "Itens de venda",
  pagamentos: "Pagamentos",
  work_orders: "Ordens de serviço",
  work_order_itens: "Itens de OS",
};

function descarregar(nome: string, conteudo: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function paraCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "\uFEFF";
  const colunas = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const celula = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const linhas = [colunas.join(";"), ...rows.map((r) => colunas.map((c) => celula(r[c])).join(";"))];
  return "\uFEFF" + linhas.join("\r\n");
}

function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function BackupsPage() {
  const qc = useQueryClient();
  const [aOcupar, setAOcupar] = useState<string | null>(null);

  const { data: resumo, isLoading } = useQuery({ queryKey: ["backup-resumo"], queryFn: () => resumoBackup() });
  const { data: guardados = [] } = useQuery({
    queryKey: ["backup-guardados"],
    queryFn: () => listarBackupsGuardados(),
  });

  const jsonFn = useServerFn(gerarBackupJson);
  const tabelaFn = useServerFn(dadosTabela);
  const todasFn = useServerFn(dadosTodasTabelas);
  const linkFn = useServerFn(linkBackupGuardado);

  const correr = useMutation({
    mutationFn: () => correrBackupAgora(),
    onSuccess: (r) => {
      if (r.drive.ok) toast.success("Backup guardado e enviado para o Google Drive.");
      else toast.warning(`Backup guardado. Google Drive falhou: ${r.drive.erro}`);
      qc.invalidateQueries({ queryKey: ["backup-guardados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function baixarJson() {
    setAOcupar("json");
    try {
      const r = await jsonFn();
      descarregar(`vrcf-backup-${hoje()}.json`, r.json, "application/json");
      toast.success("Backup JSON descarregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou o backup JSON.");
    } finally {
      setAOcupar(null);
    }
  }

  async function baixarCsv(tabela: string) {
    setAOcupar(tabela);
    try {
      const r = await tabelaFn({ data: { tabela } });
      const rows = JSON.parse(r.json) as Record<string, unknown>[];
      descarregar(`${tabela}-${hoje()}.csv`, paraCsv(rows), "text/csv;charset=utf-8");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou a exportação.");
    } finally {
      setAOcupar(null);
    }
  }

  async function baixarZip() {
    setAOcupar("zip");
    try {
      const todas = await todasFn();
      const zip = new JSZip();
      for (const t of todas) {
        const rows = JSON.parse(t.json) as Record<string, unknown>[];
        zip.file(`${t.tabela}.csv`, paraCsv(rows));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      descarregar(`vrcf-csv-${hoje()}.zip`, blob, "application/zip");
      toast.success("ZIP com todos os CSV descarregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou o ZIP.");
    } finally {
      setAOcupar(null);
    }
  }

  async function abrirGuardado(path: string) {
    try {
      const { url } = await linkFn({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou o link.");
    }
  }

  const totalLinhas = (resumo?.contagens ?? []).reduce((s, c) => s + c.linhas, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
          <p className="text-sm text-muted-foreground">
            Cópias de segurança de todos os dados. {totalLinhas > 0 && `${totalLinhas} registos no total.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={baixarJson} disabled={aOcupar === "json"}>
            <DatabaseBackup className="mr-2 h-4 w-4" />
            Backup completo (JSON)
          </Button>
          <Button variant="outline" onClick={baixarZip} disabled={aOcupar === "zip"}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Todos os CSV (ZIP)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudUpload className="h-4 w-4" /> Google Drive
          </CardTitle>
          {resumo?.drive.ligado ? (
            <Badge variant="secondary">Ligado</Badge>
          ) : (
            <Badge variant="destructive">Não ligado</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Cada backup (diário e manual) é guardado no armazenamento interno e enviado para a pasta{" "}
            <span className="font-medium text-foreground">{resumo?.drive.pasta ?? "VRCF Backups"}</span> do teu Google
            Drive. Se o envio falhar, o backup interno é sempre guardado.
          </p>
          <Button
            variant="outline"
            onClick={() => correr.mutate()}
            disabled={correr.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${correr.isPending ? "animate-spin" : ""}`} />
            Gerar backup agora
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportar por tabela (CSV para Excel)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabela</TableHead>
                <TableHead className="text-right">Registos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    A carregar…
                  </TableCell>
                </TableRow>
              )}
              {(resumo?.contagens ?? []).map((c) => (
                <TableRow key={c.tabela}>
                  <TableCell className="font-medium">{NOMES[c.tabela] ?? c.tabela}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.linhas}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => baixarCsv(c.tabela)}
                      disabled={aOcupar === c.tabela}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDriveDownload className="h-4 w-4" /> Backups automáticos guardados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ficheiro</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Ainda não há backups automáticos. O primeiro é gerado esta noite (ou usa "Gerar backup agora").
                  </TableCell>
                </TableRow>
              )}
              {guardados.map((b) => (
                <TableRow key={b.path}>
                  <TableCell className="font-medium">{b.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{tamanho(b.bytes)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => abrirGuardado(b.path)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Retenção: os backups automáticos com mais de 30 dias são apagados. As passwords e PIN nunca são incluídos nos
        ficheiros.
      </p>
    </div>
  );
}
