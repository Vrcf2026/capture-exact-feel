// Server-only: recolha de dados e envio para armazenamento / Google Drive.

export const TABELAS = [
  "company_settings",
  "utilizadores",
  "vendedores",
  "clientes",
  "catalogo",
  "stock_movimentos",
  "caixa_diario",
  "saidas_caixa",
  "registos",
  "registo_itens",
  "pagamentos",
  "work_orders",
  "work_order_itens",
] as const;

export type Tabela = (typeof TABELAS)[number];

export const BUCKET = "backups";
export const DRIVE_FOLDER = "VRCF Backups";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

type Row = Record<string, unknown>;

function limparUtilizadores(rows: Row[]): Row[] {
  return rows.map((r) => {
    const { password_hash: _ph, ...rest } = r;
    return rest;
  });
}

function limparVendedores(rows: Row[]): Row[] {
  return rows.map((r) => {
    const { pin_hash: _pin, ...rest } = r;
    return rest;
  });
}

export async function lerTabela(tabela: Tabela): Promise<Row[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows: Row[] = [];
  const tamanho = 1000;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabaseAdmin
      .from(tabela)
      .select("*")
      .range(inicio, inicio + tamanho - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const lote = (data ?? []) as Row[];
    rows.push(...lote);
    if (lote.length < tamanho) break;
  }
  if (tabela === "utilizadores") return limparUtilizadores(rows);
  if (tabela === "vendedores") return limparVendedores(rows);
  return rows;
}

export interface BackupCompleto {
  meta: {
    app: string;
    versao: number;
    gerado_em: string;
    contagens: Record<string, number>;
  };
  dados: Record<string, Row[]>;
}

export async function construirBackup(): Promise<BackupCompleto> {
  const dados: Record<string, Row[]> = {};
  const contagens: Record<string, number> = {};
  for (const t of TABELAS) {
    const rows = await lerTabela(t);
    dados[t] = rows;
    contagens[t] = rows.length;
  }
  return {
    meta: { app: "VRCF", versao: 1, gerado_em: new Date().toISOString(), contagens },
    dados,
  };
}

export function nomeFicheiro(d = new Date()): string {
  const iso = d.toISOString().slice(0, 10);
  return `vrcf-backup-${iso}.json`;
}

export function caminhoBucket(d = new Date()): string {
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}/${mes}/${nomeFicheiro(d)}`;
}

export async function guardarNoBucket(path: string, conteudo: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, new Blob([conteudo], { type: "application/json" }), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

/** Apaga backups com mais de `dias` dias. */
export async function limparAntigos(dias = 30) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const apagar: string[] = [];
  const { data: anos } = await supabaseAdmin.storage.from(BUCKET).list("", { limit: 100 });
  for (const ano of anos ?? []) {
    if (!/^\d{4}$/.test(ano.name)) continue;
    const { data: meses } = await supabaseAdmin.storage.from(BUCKET).list(ano.name, { limit: 100 });
    for (const mes of meses ?? []) {
      const { data: ficheiros } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(`${ano.name}/${mes.name}`, { limit: 1000 });
      for (const f of ficheiros ?? []) {
        const m = f.name.match(/(\d{4}-\d{2}-\d{2})/);
        if (!m) continue;
        if (new Date(`${m[1]}T00:00:00Z`).getTime() < limite) {
          apagar.push(`${ano.name}/${mes.name}/${f.name}`);
        }
      }
    }
  }
  if (apagar.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(apagar);
  return apagar.length;
}

// ============ GOOGLE DRIVE ============

function driveHeaders() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !conn) return null;
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
  };
}

export function driveConfigurado(): boolean {
  return driveHeaders() !== null;
}

async function driveFetch(url: string, init: RequestInit) {
  const h = driveHeaders();
  if (!h) throw new Error("Google Drive não está ligado.");
  const res = await fetch(url, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Drive falhou [${res.status}]: ${body}`);
    throw new Error(`Google Drive [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res;
}

async function obterOuCriarPasta(nome: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${nome.replace(/'/g, "\\'")}' and trashed=false`,
  );
  const res = await driveFetch(`${GATEWAY}/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`, {
    method: "GET",
  });
  const json = (await res.json()) as { files?: { id: string }[] };
  const existente = json.files?.[0]?.id;
  if (existente) return existente;

  const criar = await driveFetch(`${GATEWAY}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder" }),
  });
  const criado = (await criar.json()) as { id: string };
  return criado.id;
}

export async function enviarParaDrive(nome: string, conteudo: string) {
  const pastaId = await obterOuCriarPasta(DRIVE_FOLDER);
  const fronteira = `vrcf${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: nome, parents: [pastaId] });
  const corpo =
    `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${fronteira}\r\nContent-Type: application/json\r\n\r\n${conteudo}\r\n` +
    `--${fronteira}--\r\n`;

  const res = await driveFetch(
    `https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${fronteira}` },
      body: corpo,
    },
  );
  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}

/** Gera o backup, guarda no bucket, envia para o Drive e limpa antigos. */
export async function executarBackup() {
  const backup = await construirBackup();
  const conteudo = JSON.stringify(backup, null, 2);
  const nome = nomeFicheiro();
  const path = caminhoBucket();
  await guardarNoBucket(path, conteudo);

  let drive: { ok: boolean; erro?: string; link?: string } = { ok: false };
  if (driveConfigurado()) {
    try {
      const f = await enviarParaDrive(nome, conteudo);
      drive = { ok: true, ...(f.webViewLink ? { link: f.webViewLink } : {}) };
    } catch (e) {
      drive = { ok: false, erro: e instanceof Error ? e.message : "erro desconhecido" };
    }
  } else {
    drive = { ok: false, erro: "Google Drive não está ligado." };
  }

  const apagados = await limparAntigos(30);
  return {
    path,
    nome,
    bytes: conteudo.length,
    contagens: backup.meta.contagens,
    drive,
    apagados,
  };
}
