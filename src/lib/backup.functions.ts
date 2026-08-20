import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Backup completo em JSON (para download no browser). Só admin. */
export const gerarBackupJson = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { construirBackup } = await import("./backup.server");
  await requireAdmin();
  return await construirBackup();
});

/** Contagem de linhas por tabela, para a página de backups. */
export const resumoBackup = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { TABELAS, lerTabela, driveConfigurado, DRIVE_FOLDER } = await import("./backup.server");
  await requireAdmin();
  const contagens: { tabela: string; linhas: number }[] = [];
  for (const t of TABELAS) {
    const rows = await lerTabela(t);
    contagens.push({ tabela: t, linhas: rows.length });
  }
  return { contagens, drive: { ligado: driveConfigurado(), pasta: DRIVE_FOLDER } };
});

/** Dados de uma tabela (para exportar CSV). */
export const dadosTabela = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tabela: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { TABELAS, lerTabela } = await import("./backup.server");
    await requireAdmin();
    const t = TABELAS.find((x) => x === data.tabela);
    if (!t) throw new Error("Tabela inválida");
    return { tabela: t, rows: await lerTabela(t) };
  });

/** Todas as tabelas de uma vez (para o ZIP de CSV). */
export const dadosTodasTabelas = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { TABELAS, lerTabela } = await import("./backup.server");
  await requireAdmin();
  const out: { tabela: string; rows: Record<string, unknown>[] }[] = [];
  for (const t of TABELAS) out.push({ tabela: t, rows: await lerTabela(t) });
  return out;
});

/** Lista os backups automáticos guardados no armazenamento. */
export const listarBackupsGuardados = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { BUCKET } = await import("./backup.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireAdmin();

  const out: { path: string; nome: string; bytes: number; criado_em: string | null }[] = [];
  const { data: anos } = await supabaseAdmin.storage.from(BUCKET).list("", { limit: 100 });
  for (const ano of (anos ?? []).filter((a) => /^\d{4}$/.test(a.name))) {
    const { data: meses } = await supabaseAdmin.storage.from(BUCKET).list(ano.name, { limit: 100 });
    for (const mes of meses ?? []) {
      const { data: ficheiros } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(`${ano.name}/${mes.name}`, { limit: 1000 });
      for (const f of ficheiros ?? []) {
        const meta = f.metadata as { size?: number } | null;
        out.push({
          path: `${ano.name}/${mes.name}/${f.name}`,
          nome: f.name,
          bytes: meta?.size ?? 0,
          criado_em: f.created_at ?? null,
        });
      }
    }
  }
  out.sort((a, b) => b.path.localeCompare(a.path));
  return out;
});

/** Link temporário para descarregar um backup guardado. */
export const linkBackupGuardado = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { BUCKET } = await import("./backup.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/** Corre o backup automático agora (guarda no armazenamento + Google Drive). */
export const correrBackupAgora = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { executarBackup } = await import("./backup.server");
  await requireAdmin();
  return await executarBackup();
});
