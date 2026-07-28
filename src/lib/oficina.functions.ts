import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const STATUS_OS = [
  "rececionado",
  "em_diagnostico",
  "aguardar_aprovacao",
  "aprovado",
  "em_reparacao",
  "pronto",
  "entregue",
  "cancelado",
] as const;
export type StatusOS = (typeof STATUS_OS)[number];

// ============ LISTAGEM / DETALHE ============
export const listOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ status: z.enum(STATUS_OS).optional().nullable(), q: z.string().optional().nullable() })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    let query = supabaseAdmin
      .from("work_orders")
      .select("id, numero, status, cliente_nome, equipamento, marca_modelo, data_rececao, tecnico_id, valor_estimado")
      .order("data_rececao", { ascending: false })
      .limit(200);
    if (data.status) query = query.eq("status", data.status);
    if (data.q && data.q.trim()) {
      const q = data.q.trim();
      query = query.or(
        `cliente_nome.ilike.%${q}%,equipamento.ilike.%${q}%,marca_modelo.ilike.%${q}%,num_serie.ilike.%${q}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { data: os, error } = await supabaseAdmin
      .from("work_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    const { data: itens } = await supabaseAdmin
      .from("work_order_itens")
      .select("*")
      .eq("work_order_id", data.id)
      .order("id");

    // Bucket privado: gerar URLs assinadas temporárias para os anexos.
    const paths = ((os.anexos as string[] | null) ?? []).map((a) =>
      a.includes("/anexos/") ? a.split("/anexos/")[1].split("?")[0] : a,
    );
    let anexos_urls: { path: string; url: string }[] = [];
    if (paths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from("anexos")
        .createSignedUrls(paths, 60 * 60);
      anexos_urls = (signed ?? [])
        .map((s, i) => ({ path: paths[i], url: s.signedUrl ?? "" }))
        .filter((s) => s.url);
    }

    return { os, itens: itens ?? [], anexos_urls };
  });


export const listTecnicos = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOficina } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireOficina();
  const { data } = await supabaseAdmin
    .from("utilizadores")
    .select("id, nome")
    .or("acesso_oficina.eq.true,papel.eq.admin")
    .eq("ativo", true)
    .order("nome");
  return data ?? [];
});

// ============ CRIAR / ATUALIZAR ============
const criarSchema = z.object({
  cliente_id: z.string().uuid().optional().nullable(),
  cliente_nome: z.string().trim().min(1).max(200),
  contacto: z.string().trim().optional().nullable(),
  equipamento: z.string().trim().min(1).max(200),
  marca_modelo: z.string().trim().optional().nullable(),
  num_serie: z.string().trim().optional().nullable(),
  password_pin: z.string().trim().optional().nullable(),
  sintomas_cliente: z.string().trim().optional().nullable(),
  acessorios: z.array(z.string()).default([]),
  tecnico_id: z.string().uuid().optional().nullable(),
  valor_estimado: z.number().min(0).optional().nullable(),
});

export const criarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { data: os, error } = await supabaseAdmin
      .from("work_orders")
      .insert({ ...data, status: "rececionado" })
      .select("id, numero")
      .single();
    if (error || !os) throw new Error(error?.message ?? "Erro ao criar ordem de serviço.");
    return os;
  });

const atualizarSchema = z.object({
  id: z.string().uuid(),
  cliente_nome: z.string().trim().min(1).max(200).optional(),
  contacto: z.string().trim().optional().nullable(),
  equipamento: z.string().trim().min(1).max(200).optional(),
  marca_modelo: z.string().trim().optional().nullable(),
  num_serie: z.string().trim().optional().nullable(),
  password_pin: z.string().trim().optional().nullable(),
  sintomas_cliente: z.string().trim().optional().nullable(),
  acessorios: z.array(z.string()).optional(),
  checklist: z.record(z.boolean()).optional(),
  tecnico_id: z.string().uuid().optional().nullable(),
  valor_estimado: z.number().min(0).optional().nullable(),
  relatorio_intervencao: z.string().trim().optional().nullable(),
  aprovado_por: z.string().trim().optional().nullable(),
  meio_aprovacao: z.string().trim().optional().nullable(),
  assinatura_rececao: z.string().optional().nullable(),
  assinatura_entrega: z.string().optional().nullable(),
  limpeza_efetuada: z.boolean().optional(),
  testes_finais_ok: z.boolean().optional(),
  anexos: z.array(z.string()).optional(),
});

export const atualizarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => atualizarSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { id, ...resto } = data;
    const { error } = await supabaseAdmin
      .from("work_orders")
      .update({ ...resto, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mudarStatusOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUS_OS) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const extra: { status: StatusOS; updated_at: string; data_aprovacao?: string } = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "aprovado") extra.data_aprovacao = new Date().toISOString();
    const { error } = await supabaseAdmin.from("work_orders").update(extra).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ITENS (ORÇAMENTO) ============
const itemSchema = z.object({
  work_order_id: z.string().uuid(),
  catalogo_id: z.string().uuid().optional().nullable(),
  descricao: z.string().trim().min(1),
  quantidade: z.number().positive(),
  preco_unitario: z.number().min(0),
});

export const adicionarItemOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { error } = await supabaseAdmin.from("work_order_itens").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerItemOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { error } = await supabaseAdmin.from("work_order_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ASSINATURA NA RECEÇÃO ============
export const assinarRececao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), assinatura_rececao: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { error } = await supabaseAdmin
      .from("work_orders")
      .update({ assinatura_rececao: data.assinatura_rececao, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ANEXOS / FOTOS ============
const uploadSchema = z.object({
  work_order_id: z.string().uuid(),
  nome_ficheiro: z.string().trim().min(1),
  data_url: z.string().min(1), // "data:image/jpeg;base64,...."
});

export const uploadAnexoOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();

    const match = data.data_url.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Ficheiro inválido.");
    const [, mime, base64] = match;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Ficheiro demasiado grande (máx. 8MB).");

    const path = `${data.work_order_id}/${Date.now()}-${data.nome_ficheiro.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: eUp } = await supabaseAdmin.storage.from("anexos").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (eUp) throw new Error(eUp.message);

    const { data: os, error: eOs } = await supabaseAdmin
      .from("work_orders")
      .select("anexos")
      .eq("id", data.work_order_id)
      .maybeSingle();
    if (eOs || !os) throw new Error(eOs?.message ?? "Ordem de serviço não encontrada.");

    // Guardamos apenas o caminho no bucket (privado); o acesso é por URL assinada.
    const anexosAtuais = (os.anexos as string[] | null) ?? [];
    const novosAnexos = [...anexosAtuais, path];
    const { error: eUpd } = await supabaseAdmin
      .from("work_orders")
      .update({ anexos: novosAnexos, updated_at: new Date().toISOString() })
      .eq("id", data.work_order_id);
    if (eUpd) throw new Error(eUpd.message);

    return { anexos: novosAnexos };
  });

export const removerAnexoOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ work_order_id: z.string().uuid(), path: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();

    const { data: os, error: eOs } = await supabaseAdmin
      .from("work_orders")
      .select("anexos")
      .eq("id", data.work_order_id)
      .maybeSingle();
    if (eOs || !os) throw new Error(eOs?.message ?? "Ordem de serviço não encontrada.");

    const anexosAtuais = (os.anexos as string[] | null) ?? [];
    const novosAnexos = anexosAtuais.filter((a) => {
      const p = a.includes("/anexos/") ? a.split("/anexos/")[1].split("?")[0] : a;
      return p !== data.path;
    });
    const { error: eUpd } = await supabaseAdmin
      .from("work_orders")
      .update({ anexos: novosAnexos, updated_at: new Date().toISOString() })
      .eq("id", data.work_order_id);
    if (eUpd) throw new Error(eUpd.message);

    // Best-effort: apaga também o ficheiro do storage (não bloqueia se falhar).
    await supabaseAdmin.storage.from("anexos").remove([data.path]);

    return { anexos: novosAnexos };
  });

const entregaSchema = z.object({
  id: z.string().uuid(),
  assinatura_entrega: z.string().min(1, "Assinatura em falta."),
  limpeza_efetuada: z.boolean(),
  testes_finais_ok: z.boolean(),
  metodo_pagamento: z.enum(["dinheiro", "mb", "transferencia", "conta_corrente", "cheque", "outro"]),
});

export const entregarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entregaSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireOficina();

    const { data: os, error: eOs } = await supabaseAdmin
      .from("work_orders")
      .select("id, cliente_id, cliente_nome, tecnico_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (eOs || !os) throw new Error(eOs?.message ?? "Ordem de serviço não encontrada.");
    if (os.status === "entregue") throw new Error("Esta ordem de serviço já foi entregue.");

    const { data: itens } = await supabaseAdmin
      .from("work_order_itens")
      .select("catalogo_id, descricao, quantidade, preco_unitario")
      .eq("work_order_id", data.id);

    const total = (itens ?? []).reduce(
      (s, it) => s + Math.round(Number(it.quantidade) * Number(it.preco_unitario) * 100) / 100,
      0,
    );

    // Cria o registo de venda na Loja, associado ao técnico que entregou.
    let registoId: string | null = null;
    if ((itens ?? []).length > 0 && total > 0) {
      const { data: reg, error: eReg } = await supabaseAdmin
        .from("registos")
        .insert({
          cliente_id: os.cliente_id ?? null,
          utilizador_id: u.id,
          total,
          notas: `Gerado a partir da OS entregue (cliente: ${os.cliente_nome ?? "—"}).`,
        })
        .select("id")
        .single();
      if (eReg || !reg) throw new Error(eReg?.message ?? "Erro ao criar a venda na Loja.");
      registoId = reg.id;

      const linhas = (itens ?? []).map((it) => ({
        registo_id: reg.id,
        catalogo_id: it.catalogo_id,
        descricao: it.descricao,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
      }));
      const { error: eIt } = await supabaseAdmin.from("registo_itens").insert(linhas);
      if (eIt) throw new Error(eIt.message);

      const liquidado = data.metodo_pagamento !== "conta_corrente";
      const { error: eP } = await supabaseAdmin.from("pagamentos").insert({
        registo_id: reg.id,
        metodo: data.metodo_pagamento,
        valor: total,
        liquidado,
        liquidado_em: liquidado ? new Date().toISOString() : null,
        liquidado_por: liquidado ? u.id : null,
      });
      if (eP) throw new Error(eP.message);
    }

    const { error: eUpd } = await supabaseAdmin
      .from("work_orders")
      .update({
        status: "entregue",
        assinatura_entrega: data.assinatura_entrega,
        limpeza_efetuada: data.limpeza_efetuada,
        testes_finais_ok: data.testes_finais_ok,
        data_entrega: new Date().toISOString(),
        valor_total_pago: total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (eUpd) throw new Error(eUpd.message);

    return { ok: true, registo_id: registoId, total };
  });
