import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ============ CAIXA ============
async function verificarPinVendedor(vendedorId: string, pin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: v } = await supabaseAdmin
    .from("vendedores")
    .select("id, pin_hash, ativo")
    .eq("id", vendedorId)
    .maybeSingle();
  if (!v || !v.ativo) throw new Error("Vendedor inválido.");
  const ok = await bcrypt.compare(pin, v.pin_hash);
  if (!ok) throw new Error("PIN incorreto.");
}

const pinSchema = {
  vendedor_id: z.string().uuid(),
  vendedor_pin: z.string().regex(/^\d{4,8}$/, "PIN inválido."),
};

export const listCaixa = createServerFn({ method: "GET" }).handler(async () => {
  const { requireLoja } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireLoja();
  const { data } = await supabaseAdmin
    .from("caixa_diario")
    .select(
      "*, abertura:utilizadores!utilizador_abertura_id(nome), fecho:utilizadores!utilizador_fecho_id(nome), reabertura:utilizadores!reaberta_por(nome)",
    )
    .order("data", { ascending: false })
    .limit(60);
  return data ?? [];
});

async function calcularTotais(caixaId: string, saldoInicial: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pagamentos } = await supabaseAdmin
    .from("pagamentos")
    .select("valor, metodo, liquidado")
    .eq("caixa_diario_id", caixaId);
  const { data: saidas } = await supabaseAdmin
    .from("saidas_caixa")
    .select("valor, tipo")
    .eq("caixa_id", caixaId);

  const totais = {
    dinheiro: 0,
    mb: 0,
    transferencia: 0,
    cheque: 0,
    outro: 0,
    conta_corrente: 0,
    numPagamentos: (pagamentos ?? []).length,
    sangrias: 0,
    despesas: 0,
  } as Record<string, number>;

  for (const p of pagamentos ?? []) {
    const chave = p.metodo in totais ? p.metodo : "outro";
    totais[chave] += Number(p.valor);
  }
  for (const s of saidas ?? []) {
    if (s.tipo === "sangria") totais.sangrias += Number(s.valor);
    else totais.despesas += Number(s.valor);
  }
  const saldoEsperado = saldoInicial + totais.dinheiro - totais.sangrias - totais.despesas;
  return {
    dinheiro: totais.dinheiro,
    mb: totais.mb,
    transferencia: totais.transferencia,
    cheque: totais.cheque,
    outro: totais.outro,
    conta_corrente: totais.conta_corrente,
    numPagamentos: totais.numPagamentos,
    sangrias: totais.sangrias,
    despesas: totais.despesas,
    saldoEsperado,
  };
}

export const caixaAberto = createServerFn({ method: "GET" }).handler(async () => {
  const { requireLoja } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireLoja();
  const { data: caixa } = await supabaseAdmin
    .from("caixa_diario")
    .select("*")
    .eq("estado", "aberto")
    .order("aberto_em", { ascending: false })
    .maybeSingle();
  if (!caixa) return null;
  const { data: saidas } = await supabaseAdmin
    .from("saidas_caixa")
    .select("*, utilizadores(nome)")
    .eq("caixa_id", caixa.id)
    .order("criado_em", { ascending: false });
  const totais = await calcularTotais(caixa.id, Number(caixa.saldo_inicial));
  return { caixa, saidas: saidas ?? [], totais };
});

export const abrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ valor_inicial: z.number().min(0), data: z.string().min(1), ...pinSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await verificarPinVendedor(data.vendedor_id, data.vendedor_pin);

    const { data: existente } = await supabaseAdmin
      .from("caixa_diario")
      .select("id")
      .eq("data", data.data)
      .eq("estado", "aberto")
      .maybeSingle();
    if (existente) throw new Error("Já existe uma caixa aberta para esse dia.");
    const { error } = await supabaseAdmin.from("caixa_diario").insert({
      data: data.data,
      saldo_inicial: data.valor_inicial,
      utilizador_abertura_id: u.id,
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
      ...pinSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await verificarPinVendedor(data.vendedor_id, data.vendedor_pin);

    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario")
      .select("id, num_fechos")
      .eq("id", data.id)
      .maybeSingle();
    if (!caixa) throw new Error("Caixa não encontrada.");
    if ((caixa.num_fechos ?? 0) >= 1 && u.papel !== "admin") {
      throw new Error("Este dia já foi fechado. Só o administrador pode retificar o fecho.");
    }

    await supabaseAdmin
      .from("caixa_diario")
      .update({
        estado: "fechado",
        saldo_final: data.valor_final_contado,
        observacoes: data.observacoes ?? null,
        fechado_em: new Date().toISOString(),
        utilizador_fecho_id: u.id,
        num_fechos: (caixa.num_fechos ?? 0) + 1,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const reabrirCaixa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(3).max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireAdmin();

    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario")
      .select("id, data, estado")
      .eq("id", data.id)
      .maybeSingle();
    if (!caixa) throw new Error("Caixa não encontrada.");
    if (caixa.estado === "aberto") throw new Error("Esta caixa já está aberta.");

    const { data: outra } = await supabaseAdmin
      .from("caixa_diario")
      .select("id")
      .eq("data", caixa.data)
      .eq("estado", "aberto")
      .maybeSingle();
    if (outra) throw new Error("Já existe outra caixa aberta nesse dia.");

    const { error } = await supabaseAdmin
      .from("caixa_diario")
      .update({
        estado: "aberto",
        reaberta: true,
        reaberta_em: new Date().toISOString(),
        reaberta_por: u.id,
        reaberta_motivo: data.motivo,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adicionarSaida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      caixa_id: z.string().uuid(),
      tipo: z.enum(["sangria", "despesa"]),
      descricao: z.string().trim().min(1).max(200),
      valor: z.number().positive(),
      ...pinSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireLoja();
    await verificarPinVendedor(data.vendedor_id, data.vendedor_pin);

    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario")
      .select("id")
      .eq("id", data.caixa_id)
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Abra a caixa antes de registar saídas.");

    const { error } = await supabaseAdmin.from("saidas_caixa").insert({
      caixa_id: data.caixa_id,
      tipo: data.tipo,
      descricao: data.descricao,
      valor: data.valor,
      utilizador_id: u.id,
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

    const { data: caixa } = await supabaseAdmin
      .from("caixa_diario")
      .select("id")
      .eq("estado", "aberto")
      .maybeSingle();
    if (!caixa) throw new Error("Abra a caixa antes de registar vendas.");

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
        caixa_diario_id: caixa.id,
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
      caixa_diario_id: caixa.id,
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
        .select("valor, descricao, tipo, criado_em")
        .gte("criado_em", data.desde)
        .lte("criado_em", data.ate),
    ]);
    return {
      vendas: vendas ?? [],
      pagamentos: (pags ?? []).filter((p) => !(p.registo as { anulado?: boolean } | null)?.anulado),
      saidas: saidas ?? [],
    };
  });
