import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ============ CAIXA ============
export const listCaixa = createServerFn({ method: "GET" }).handler(async () => {
  const { requireLoja } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireLoja();
  const { data } = await supabaseAdmin
    .from("caixa_diario")
    .select("*")
    .order("data", { ascending: false })
    .limit(60);
  return data ?? [];
});

export const caixaAberto = createServerFn({ method: "GET" }).handler(async () => {
  const { requireLoja } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireLoja();
  const { data: caixa } = await supabaseAdmin
    .from("caixa_diario")
    .select("*")
    .is("fechado_em", null)
    .order("aberto_em", { ascending: false })
    .maybeSingle();
  if (!caixa) return null;
  const { data: saidas } = await supabaseAdmin
    .from("saidas_caixa")
    .select("*")
    .eq("caixa_id", caixa.id)
    .order("criado_em", { ascending: false });
  return { caixa, saidas: saidas ?? [] };
});

export const abrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ valor_inicial: z.number().min(0), data: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    const { data: existente } = await supabaseAdmin
      .from("caixa_diario")
      .select("id")
      .is("fechado_em", null)
      .maybeSingle();
    if (existente) throw new Error("Já existe um caixa aberto.");
    const { error } = await supabaseAdmin.from("caixa_diario").insert({
      data: data.data,
      valor_inicial: data.valor_inicial,
      aberto_por: u.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fecharCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      valor_final_contado: z.number().min(0),
      observacoes: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await supabaseAdmin
      .from("caixa_diario")
      .update({
        valor_final_contado: data.valor_final_contado,
        observacoes: data.observacoes ?? null,
        fechado_em: new Date().toISOString(),
        fechado_por: u.id,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const adicionarSaida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      caixa_id: z.string().uuid(),
      motivo: z.string().trim().min(1).max(200),
      valor: z.number().positive(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    const { error } = await supabaseAdmin.from("saidas_caixa").insert({
      caixa_id: data.caixa_id,
      motivo: data.motivo,
      valor: data.valor,
      criado_por: u.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerSaida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    await supabaseAdmin.from("saidas_caixa").delete().eq("id", data.id);
    return { ok: true };
  });

// ============ VENDA ============
const itemSchema = z.object({
  catalogo_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(300),
  quantidade: z.number().positive(),
  preco_unitario: z.number().min(0),
});
const pagamentoSchema = z.object({
  metodo: z.enum(["dinheiro", "mb", "transferencia", "conta_corrente", "cheque", "outro"]),
  valor: z.number().positive(),
});
const vendaSchema = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  vendedor_id: z.string().uuid().nullable().optional(),
  vendedor_pin: z.string().regex(/^\d{4,8}$/).optional(),
  usar_utilizador_sessao: z.boolean().default(true),
  itens: z.array(itemSchema).min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
  notas: z.string().optional().nullable(),
});

export const criarVenda = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => vendaSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();

    let utilizador_id: string | null = null;
    let vendedor_id: string | null = null;

    if (data.vendedor_id) {
      if (!data.vendedor_pin) throw new Error("PIN do vendedor em falta.");
      const { data: v } = await supabaseAdmin
        .from("vendedores")
        .select("id, pin_hash, ativo")
        .eq("id", data.vendedor_id)
        .maybeSingle();
      if (!v || !v.ativo) throw new Error("Vendedor inválido.");
      const ok = await bcrypt.compare(data.vendedor_pin, v.pin_hash);
      if (!ok) throw new Error("PIN incorreto.");
      vendedor_id = v.id;
    } else {
      utilizador_id = u.id;
    }

    const total = data.itens.reduce(
      (s, it) => s + Math.round(it.quantidade * it.preco_unitario * 100) / 100,
      0,
    );
    const somaPag = data.pagamentos.reduce((s, p) => s + p.valor, 0);
    if (Math.abs(somaPag - total) > 0.01)
      throw new Error(
        `Total (${total.toFixed(2)}€) diferente da soma dos pagamentos (${somaPag.toFixed(2)}€).`,
      );

    const { data: reg, error } = await supabaseAdmin
      .from("registos")
      .insert({
        cliente_id: data.cliente_id ?? null,
        utilizador_id,
        vendedor_id,
        total,
        notas: data.notas ?? null,
      })
      .select("id, numero")
      .single();
    if (error || !reg) throw new Error(error?.message ?? "Erro ao criar venda.");

    const itens = data.itens.map((it) => ({
      registo_id: reg.id,
      catalogo_id: it.catalogo_id ?? null,
      descricao: it.descricao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
    }));
    const { error: eIt } = await supabaseAdmin.from("registo_itens").insert(itens);
    if (eIt) throw new Error(eIt.message);

    const pags = data.pagamentos.map((p) => ({
      registo_id: reg.id,
      metodo: p.metodo,
      valor: p.valor,
      liquidado: p.metodo !== "conta_corrente",
      liquidado_em: p.metodo !== "conta_corrente" ? new Date().toISOString() : null,
      liquidado_por: p.metodo !== "conta_corrente" ? u.id : null,
    }));
    const { error: eP } = await supabaseAdmin.from("pagamentos").insert(pags);
    if (eP) throw new Error(eP.message);

    return { id: reg.id, numero: reg.numero };
  });

// ============ REGISTOS ============
const filtrosSchema = z.object({
  desde: z.string().optional().nullable(),
  ate: z.string().optional().nullable(),
  cliente_id: z.string().uuid().optional().nullable(),
  incluir_anulados: z.boolean().default(false),
});

export const listRegistos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => filtrosSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    let q = supabaseAdmin
      .from("registos")
      .select(
        `id, numero, data, total, faturado, anulado, notas,
         cliente:cliente_id(id, nome),
         utilizador:utilizador_id(id, nome),
         vendedor:vendedor_id(id, nome)`,
      )
      .order("data", { ascending: false })
      .limit(500);
    if (data.desde) q = q.gte("data", data.desde);
    if (data.ate) q = q.lte("data", data.ate);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    if (!data.incluir_anulados) q = q.eq("anulado", false);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    const [{ data: r }, { data: itens }, { data: pags }] = await Promise.all([
      supabaseAdmin
        .from("registos")
        .select(
          `*, cliente:cliente_id(id, nome, nif), utilizador:utilizador_id(id, nome), vendedor:vendedor_id(id, nome)`,
        )
        .eq("id", data.id)
        .maybeSingle(),
      supabaseAdmin.from("registo_itens").select("*").eq("registo_id", data.id),
      supabaseAdmin.from("pagamentos").select("*").eq("registo_id", data.id),
    ]);
    return { registo: r, itens: itens ?? [], pagamentos: pags ?? [] };
  });

export const marcarFaturado = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), faturado: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await supabaseAdmin
      .from("registos")
      .update({
        faturado: data.faturado,
        faturado_em: data.faturado ? new Date().toISOString() : null,
        faturado_por: data.faturado ? u.id : null,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const anularRegisto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(1).max(400) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await supabaseAdmin
      .from("registos")
      .update({
        anulado: true,
        anulado_em: new Date().toISOString(),
        anulado_por: u.id,
        anulado_motivo: data.motivo,
      })
      .eq("id", data.id);
    return { ok: true };
  });

// ============ CONTA CORRENTE ============
export const listContaCorrente = createServerFn({ method: "GET" }).handler(async () => {
  const { requireLoja } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireLoja();
  const { data } = await supabaseAdmin
    .from("pagamentos")
    .select(
      `id, valor, data, liquidado, liquidado_em, notas,
       registo:registo_id(id, numero, data, anulado, cliente:cliente_id(id, nome, nif, telefone))`,
    )
    .eq("metodo", "conta_corrente")
    .order("data", { ascending: false });
  return data ?? [];
});

export const liquidarPagamento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await supabaseAdmin
      .from("pagamentos")
      .update({
        liquidado: true,
        liquidado_em: new Date().toISOString(),
        liquidado_por: u.id,
      })
      .eq("id", data.id);
    return { ok: true };
  });

// ============ RELATÓRIOS ============
const relatSchema = z.object({
  desde: z.string(),
  ate: z.string(),
});

export const relatorio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => relatSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    const [{ data: vendas }, { data: pags }, { data: saidas }] = await Promise.all([
      supabaseAdmin
        .from("registos")
        .select(
          `id, numero, data, total, anulado,
           utilizador:utilizador_id(id, nome),
           vendedor:vendedor_id(id, nome)`,
        )
        .gte("data", data.desde)
        .lte("data", data.ate)
        .eq("anulado", false),
      supabaseAdmin
        .from("pagamentos")
        .select("metodo, valor, data, registo:registo_id(anulado)")
        .gte("data", data.desde)
        .lte("data", data.ate),
      supabaseAdmin
        .from("saidas_caixa")
        .select("valor, motivo, criado_em")
        .gte("criado_em", data.desde)
        .lte("criado_em", data.ate),
    ]);
    return {
      vendas: vendas ?? [],
      pagamentos: (pags ?? []).filter((p) => !(p.registo as { anulado?: boolean } | null)?.anulado),
      saidas: saidas ?? [],
    };
  });
