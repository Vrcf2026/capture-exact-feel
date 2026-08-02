import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============ KPIs da Oficina para o Painel ============
export const resumoOficinaHoje = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const { data: rows, error } = await supabaseAdmin
    .from("work_orders")
    .select("id, status, data_rececao, data_entrega, valor_total_pago");
  if (error) throw new Error(error.message);

  const porEstado: Record<string, number> = {};
  let abertas = 0;
  let entreguesHoje = 0;
  let recebidasHoje = 0;
  let faturadoHoje = 0;

  for (const r of rows ?? []) {
    porEstado[r.status] = (porEstado[r.status] ?? 0) + 1;
    if (r.status !== "entregue") abertas += 1;
    if (r.data_entrega && new Date(r.data_entrega) >= inicio) {
      entreguesHoje += 1;
      faturadoHoje += Number(r.valor_total_pago ?? 0);
    }
    if (r.data_rececao && new Date(r.data_rececao) >= inicio) recebidasHoje += 1;
  }

  return { total: (rows ?? []).length, abertas, entreguesHoje, recebidasHoje, faturadoHoje, porEstado };
});

// ============ Pesquisa global (nº venda / nº OS / cliente) ============
export const pesquisaGlobal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireUser();
    const q = data.q;
    const numero = /^\d+$/.test(q) ? Number(q) : null;

    const podeLoja = u.acesso_loja || u.papel === "admin";
    const podeOficina = u.acesso_oficina || u.papel === "admin";

    const clientesRes = await supabaseAdmin
      .from("clientes")
      .select("id, nome, nif, telefone")
      .or(`nome.ilike.%${q}%,nif.ilike.%${q}%,telefone.ilike.%${q}%`)
      .limit(6);

    let registos: { id: string; numero: number; total: number; data: string; anulado: boolean }[] = [];
    if (podeLoja) {
      let rq = supabaseAdmin
        .from("registos")
        .select("id, numero, total, data, anulado")
        .order("data", { ascending: false })
        .limit(6);
      if (numero !== null) rq = rq.eq("numero", numero);
      else rq = rq.eq("numero", -1);
      const { data: rows } = await rq;
      registos = (rows ?? []) as typeof registos;
    }

    let ordens: { id: string; numero: number; status: string; cliente_nome: string | null }[] = [];
    if (podeOficina) {
      let oq = supabaseAdmin
        .from("work_orders")
        .select("id, numero, status, cliente_nome")
        .order("data_rececao", { ascending: false })
        .limit(6);
      oq = numero !== null ? oq.eq("numero", numero) : oq.ilike("cliente_nome", `%${q}%`);
      const { data: rows } = await oq;
      ordens = (rows ?? []) as typeof ordens;
    }

    return { clientes: clientesRes.data ?? [], registos, ordens };
  });

// ============ Ficha de cliente (histórico Loja + Oficina) ============
export const fichaCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUser();

    const { data: cliente, error } = await supabaseAdmin
      .from("clientes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) throw new Error("Cliente não encontrado.");

    const { data: registos } = await supabaseAdmin
      .from("registos")
      .select("id, numero, data, total, anulado, faturado")
      .eq("cliente_id", data.id)
      .order("data", { ascending: false })
      .limit(100);

    const ids = (registos ?? []).map((r) => r.id);
    const { data: pagamentos } = ids.length
      ? await supabaseAdmin
          .from("pagamentos")
          .select("registo_id, metodo, valor, liquidado")
          .in("registo_id", ids)
      : { data: [] as { registo_id: string; metodo: string; valor: number; liquidado: boolean }[] };

    const { data: ordens } = await supabaseAdmin
      .from("work_orders")
      .select("id, numero, status, equipamento, marca_modelo, data_rececao, data_entrega, valor_total_pago")
      .eq("cliente_id", data.id)
      .order("data_rececao", { ascending: false })
      .limit(100);

    const totalCompras = (registos ?? [])
      .filter((r) => !r.anulado)
      .reduce((s, r) => s + Number(r.total), 0);
    const emDivida = (pagamentos ?? [])
      .filter((p) => !p.liquidado)
      .reduce((s, p) => s + Number(p.valor), 0);

    return {
      cliente,
      registos: registos ?? [],
      ordens: ordens ?? [],
      totalCompras,
      emDivida,
    };
  });

// ============ Alertas do Painel ============
export const alertasPainel = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const u = await requireUser();

  const podeLoja = u.acesso_loja || u.papel === "admin";
  const podeOficina = u.acesso_oficina || u.papel === "admin";

  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);

  // --- Caixa ---
  let caixaAbertaHoje = false;
  let caixaAnteriorAberta: { id: string; data: string } | null = null;
  if (podeLoja) {
    const { data: abertas } = await supabaseAdmin
      .from("caixa_diario")
      .select("id, data, estado")
      .eq("estado", "aberto")
      .order("data", { ascending: false });
    for (const c of abertas ?? []) {
      if (c.data === hojeISO) caixaAbertaHoje = true;
      else if (!caixaAnteriorAberta) caixaAnteriorAberta = { id: c.id, data: c.data };
    }
  }

  // --- OS pendentes ---
  let osProntas = 0;
  let osParadas = 0;
  let osAguardaAprovacao = 0;
  const LIMITE_DIAS = 7;
  if (podeOficina) {
    const { data: rows } = await supabaseAdmin
      .from("work_orders")
      .select("id, status, data_rececao, updated_at")
      .neq("status", "entregue");
    const limite = Date.now() - LIMITE_DIAS * 86400000;
    for (const r of rows ?? []) {
      if (r.status === "concluido") osProntas += 1;
      if (r.status === "orcamento") osAguardaAprovacao += 1;
      const ref = new Date(r.updated_at ?? r.data_rececao).getTime();
      if (ref < limite) osParadas += 1;
    }
  }

  // --- Dívidas (pagamentos a crédito não liquidados) ---
  let dividaTotal = 0;
  let dividaClientes = 0;
  if (podeLoja) {
    const { data: pend } = await supabaseAdmin
      .from("pagamentos")
      .select("valor, registo_id, registos!inner(anulado, cliente_id)")
      .eq("liquidado", false);
    const clientes = new Set<string>();
    for (const p of (pend ?? []) as unknown as {
      valor: number;
      registos: { anulado: boolean; cliente_id: string | null } | null;
    }[]) {
      if (p.registos?.anulado) continue;
      dividaTotal += Number(p.valor);
      if (p.registos?.cliente_id) clientes.add(p.registos.cliente_id);
    }
    dividaClientes = clientes.size;
  }

  return {
    podeLoja,
    podeOficina,
    caixaAbertaHoje,
    caixaAnteriorAberta,
    osProntas,
    osParadas,
    osAguardaAprovacao,
    limiteDias: LIMITE_DIAS,
    dividaTotal,
    dividaClientes,
  };
});
