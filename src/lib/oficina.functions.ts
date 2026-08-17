import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============ ESTADOS (iguais aos do vrcftecnica original) ============
export const STATUS_OS = [
  "recebido",
  "diagnostico",
  "orcamento",
  "aprovado",
  "nao_aprovado",
  "em_reparacao",
  "sem_reparacao",
  "concluido",
  "entregue",
] as const;
export type StatusOS = (typeof STATUS_OS)[number];

export const STATUS_LABELS: Record<StatusOS, string> = {
  recebido: "Recebido",
  diagnostico: "Em Diagnóstico",
  orcamento: "Orçamento Enviado",
  aprovado: "Aprovado",
  nao_aprovado: "Não Aprovado",
  em_reparacao: "Em Reparação",
  sem_reparacao: "Sem Reparação",
  concluido: "Concluído",
  entregue: "Entregue",
};

// Ordem para deteção de "retrocesso" manual (trava as transições automáticas).
export const STATUS_ORDER: StatusOS[] = [
  "recebido", "diagnostico", "orcamento", "aprovado", "nao_aprovado",
  "em_reparacao", "sem_reparacao", "concluido", "entregue",
];

// ============ CHECKLIST / ACESSÓRIOS (iguais ao vrcftecnica original) ============
export const CHECK_STATUS = ["ok", "defeito", "na"] as const;
export type CheckStatus = (typeof CHECK_STATUS)[number] | null;

export interface ChecklistItem {
  item: string;
  status: CheckStatus;
  notas: string;
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: "Arranque / Sistema", status: null, notas: "" },
  { item: "Ecrã (Imagem/Riscos)", status: null, notas: "" },
  { item: "Teclado / Touchpad", status: null, notas: "" },
  { item: "Portas (USB/Carga)", status: null, notas: "" },
  { item: "Som e Microfone", status: null, notas: "" },
  { item: "Wi-Fi / Bluetooth", status: null, notas: "" },
  { item: "Dobradiças / Carcaça", status: null, notas: "" },
  { item: "Bateria", status: null, notas: "" },
];

export const ACESSORIOS_OPTIONS = ["Carregador", "Bateria", "Rato", "Bolsa"] as const;

export const MEIO_APROVACAO_OPTIONS = [
  { v: "tel", label: "Telefone" },
  { v: "whatsapp", label: "WhatsApp" },
  { v: "presencial", label: "Presencial" },
  { v: "email", label: "Email" },
] as const;

const SIGNED_URL_TTL = 60 * 60; // 1 hora, igual ao vrcftecnica original

interface AnexoMeta {
  id: string;
  nome: string;
  tipo: string;
  path: string; // path no bucket privado "anexos"
  adicionadoEm: string;
}

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
      .select("id, numero, status, cliente_nome, equipamento, marca_modelo, data_rececao, tecnico_id, valor_estimado, prazo_estimado")
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

    // Gera URLs assinadas (1h) para cada anexo, para o bucket privado.
    const anexos = ((os.anexos as AnexoMeta[] | null) ?? []) as AnexoMeta[];
    const anexosComUrl = await Promise.all(
      anexos.map(async (a) => {
        const { data: signed } = await supabaseAdmin.storage.from("anexos").createSignedUrl(a.path, SIGNED_URL_TTL);
        return { ...a, url: signed?.signedUrl ?? null };
      }),
    );

    return { os, itens: itens ?? [], anexos: anexosComUrl };
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
const checklistItemSchema = z.object({
  item: z.string(),
  status: z.enum(["ok", "defeito", "na"]).nullable(),
  notas: z.string(),
});

const camposComuns = {
  cliente_rapido: z.boolean().optional(),
  cliente_id: z.string().uuid().optional().nullable(),
  cliente_nome: z.string().trim().min(1).max(200),
  contacto: z.string().trim().optional().nullable(),
  equipamento: z.string().trim().optional().nullable(),
  marca_modelo: z.string().trim().optional().nullable(),
  num_serie: z.string().trim().optional().nullable(),
  password_pin: z.string().trim().optional().nullable(),
  checklist: z.array(checklistItemSchema).optional(),
  acessorios: z.array(z.string()).optional(),
  sintomas_cliente: z.string().trim().optional().nullable(),
  tecnico_id: z.string().uuid().optional().nullable(),
  diagnostico_tecnico: z.string().trim().optional().nullable(),
  valor_estimado: z.number().min(0).optional().nullable(),
  aprovado_por: z.string().trim().optional().nullable(),
  meio_aprovacao: z.string().trim().optional().nullable(),
  data_aprovacao: z.string().optional().nullable(),
  prazo_estimado: z.string().optional().nullable(),
  relatorio_intervencao: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  observacoes_incluir_pdf: z.boolean().optional(),
  assinatura_rececao: z.string().optional().nullable(),
};

export const criarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ...camposComuns }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { data: os, error } = await supabaseAdmin
      .from("work_orders")
      .insert({ ...data, status: "recebido", checklist: (data.checklist ?? DEFAULT_CHECKLIST) as unknown as never })
      .select("id, numero")
      .single();
    if (error || !os) throw new Error(error?.message ?? "Erro ao criar ordem de serviço.");
    return os;
  });

export const atualizarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), auto_status_locked: z.boolean().optional(), ...camposComuns })
      .partial({ cliente_nome: true })
      .parse(d),
  )
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

// Aplica as mesmas transições automáticas de estado do vrcftecnica original,
// a não ser que auto_status_locked esteja ativo (o utilizador já recuou o estado à mão).
export const mudarStatusOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUS_OS), auto_status_locked: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();
    const { error } = await supabaseAdmin
      .from("work_orders")
      .update({
        status: data.status,
        auto_status_locked: data.auto_status_locked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ITENS (ORÇAMENTO — ligado ao catálogo partilhado com a Loja) ============
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

// ============ ANEXOS / FOTOS (bucket privado, como no vrcftecnica original) ============
const uploadSchema = z.object({
  work_order_id: z.string().uuid(),
  nome_ficheiro: z.string().trim().min(1),
  data_url: z.string().min(1),
});

export const uploadAnexoOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireOficina();

    const match = data.data_url.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Ficheiro inválido.");
    const [, mime, base64] = match;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Ficheiro demasiado grande (máx. 8MB).");

    const fileId = crypto.randomUUID();
    const path = `${u.id}/${fileId}`;
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

    const novoAnexo: AnexoMeta = {
      id: fileId,
      nome: data.nome_ficheiro,
      tipo: mime,
      path,
      adicionadoEm: new Date().toISOString(),
    };
    const anexosAtuais = ((os.anexos as AnexoMeta[] | null) ?? []) as AnexoMeta[];
    const novosAnexos = [...anexosAtuais, novoAnexo];
    const { error: eUpd } = await supabaseAdmin
      .from("work_orders")
      .update({ anexos: novosAnexos as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", data.work_order_id);
    if (eUpd) throw new Error(eUpd.message);

    return { ok: true };
  });

export const removerAnexoOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ work_order_id: z.string().uuid(), anexo_id: z.string() }).parse(d))
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

    const anexosAtuais = ((os.anexos as AnexoMeta[] | null) ?? []) as AnexoMeta[];
    const alvo = anexosAtuais.find((a) => a.id === data.anexo_id);
    const novosAnexos = anexosAtuais.filter((a) => a.id !== data.anexo_id);
    const { error: eUpd } = await supabaseAdmin
      .from("work_orders")
      .update({ anexos: novosAnexos as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", data.work_order_id);
    if (eUpd) throw new Error(eUpd.message);

    if (alvo) await supabaseAdmin.storage.from("anexos").remove([alvo.path]).catch(() => {});
    return { ok: true };
  });

// ============ ENTREGA (gera venda na Loja — ligação nova, mantida) ============
const entregaSchema = z.object({
  id: z.string().uuid(),
  assinatura_entrega: z.string().min(1, "Assinatura em falta."),
  limpeza_efetuada: z.boolean(),
  testes_finais_ok: z.boolean(),
  valor_total_pago: z.number().min(0).optional().nullable(),
  metodo_pagamento: z.enum([
    "dinheiro",
    "mb",
    "transferencia",
    "conta_corrente",
    "cheque",
    "encontro_contas",
    "outro",
  ]),
  nota_pagamento: z.string().trim().max(500).optional().nullable(),
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
      if (data.metodo_pagamento === "encontro_contas" && (data.nota_pagamento ?? "").trim().length < 3)
        throw new Error("Descreva o motivo do encontro de contas.");
      const { error: eP } = await supabaseAdmin.from("pagamentos").insert({
        registo_id: reg.id,
        metodo: data.metodo_pagamento,
        valor: total,
        notas: data.nota_pagamento?.trim() || null,
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
        valor_total_pago: data.valor_total_pago ?? total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (eUpd) throw new Error(eUpd.message);

    return { ok: true, registo_id: registoId, total };
  });

// ============ ADMIN: ELIMINAR / ARQUIVAR ANTIGAS ============
export const eliminarOS = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireOficina();
    if (u.papel !== "admin") throw new Error("Só o administrador pode eliminar ordens de serviço.");
    const { error } = await supabaseAdmin.from("work_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOSAntesDe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ data_limite: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireOficina();
    if (u.papel !== "admin") throw new Error("Só o administrador pode ver esta lista.");
    const { data: rows, error } = await supabaseAdmin
      .from("work_orders")
      .select("id, numero, cliente_nome, created_at")
      .lt("created_at", data.data_limite);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const purgarOSAntesDe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ data_limite: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireOficina();
    if (u.papel !== "admin") throw new Error("Só o administrador pode arquivar/apagar ordens de serviço.");
    const { error } = await supabaseAdmin.from("work_orders").delete().lt("created_at", data.data_limite);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ RELATÓRIOS DA OFICINA ============
const relatorioSchema = z.object({ inicio: z.string(), fim: z.string() });

export const relatorioOficina = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => relatorioSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireOficina } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOficina();

    const { data: rows, error } = await supabaseAdmin
      .from("work_orders")
      .select("id, numero, status, cliente_nome, tecnico_id, data_rececao, data_entrega, valor_total_pago, valor_estimado")
      .gte("data_rececao", data.inicio)
      .lte("data_rececao", data.fim + "T23:59:59");
    if (error) throw new Error(error.message);

    const porEstado: Record<string, number> = {};
    let totalFaturado = 0;
    let somaDias = 0;
    let contDias = 0;

    for (const r of rows ?? []) {
      porEstado[r.status] = (porEstado[r.status] ?? 0) + 1;
      if (r.status === "entregue") {
        totalFaturado += Number(r.valor_total_pago ?? 0);
        if (r.data_entrega && r.data_rececao) {
          const dias = (new Date(r.data_entrega).getTime() - new Date(r.data_rececao).getTime()) / 86_400_000;
          somaDias += dias;
          contDias += 1;
        }
      }
    }

    return {
      total_os: (rows ?? []).length,
      por_estado: porEstado,
      total_faturado: totalFaturado,
      tempo_medio_dias: contDias > 0 ? Math.round((somaDias / contDias) * 10) / 10 : null,
      ordens: rows ?? [],
    };
  });
