import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listStock = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();
  const { data } = await supabaseAdmin
    .from("catalogo")
    .select("id, codigo, nome, tipo, unidade, ativo, controla_stock, stock, stock_minimo")
    .eq("controla_stock", true)
    .order("nome");
  return data ?? [];
});

export const listMovimentos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        catalogo_id: z.string().uuid().optional().nullable(),
        limite: z.number().int().min(1).max(500).default(200),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUser();
    let q = supabaseAdmin
      .from("stock_movimentos")
      .select(
        `id, tipo, quantidade, motivo, stock_apos, criado_em,
         catalogo:catalogo_id(id, codigo, nome, unidade),
         utilizador:utilizador_id(id, nome),
         vendedor:vendedor_id(id, nome),
         registo:registo_id(id, numero)`,
      )
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    if (data.catalogo_id) q = q.eq("catalogo_id", data.catalogo_id);
    const { data: rows } = await q;
    return rows ?? [];
  });

const movSchema = z
  .object({
    catalogo_id: z.string().uuid(),
    tipo: z.enum(["entrada", "saida", "ajuste"]),
    quantidade: z.number().positive(),
    motivo: z.string().trim().max(400).optional().nullable(),
    vendedor_id: z.string().uuid(),
    vendedor_pin: z.string().regex(/^\d{4,8}$/, "PIN inválido."),
  })
  .refine((m) => m.tipo === "entrada" || (m.motivo ?? "").trim().length >= 3, {
    message: "Indique o motivo da saída/ajuste.",
    path: ["motivo"],
  });

export const registarMovimento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => movSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bcrypt = (await import("bcryptjs")).default;
    const u = await requireUser();

    const { data: vend } = await supabaseAdmin
      .from("vendedores")
      .select("id, nome, pin_hash, ativo")
      .eq("id", data.vendedor_id)
      .maybeSingle();
    if (!vend || !vend.ativo) throw new Error("Vendedor inválido ou inativo.");
    const okPin = await bcrypt.compare(data.vendedor_pin, vend.pin_hash);
    if (!okPin) throw new Error("PIN do vendedor incorreto.");

    const { data: item } = await supabaseAdmin
      .from("catalogo")
      .select("id, nome, stock, controla_stock")
      .eq("id", data.catalogo_id)
      .maybeSingle();
    if (!item) throw new Error("Artigo não encontrado.");
    if (!item.controla_stock) throw new Error(`"${item.nome}" não tem controlo de stock ativo.`);

    const atual = Number(item.stock ?? 0);
    const novo =
      data.tipo === "entrada"
        ? atual + data.quantidade
        : data.tipo === "saida"
          ? atual - data.quantidade
          : data.quantidade;

    if (novo < 0) throw new Error(`Stock insuficiente: existem ${atual} unidade(s) de "${item.nome}".`);

    const { error: eUp } = await supabaseAdmin
      .from("catalogo")
      .update({ stock: novo })
      .eq("id", data.catalogo_id);
    if (eUp) throw new Error(eUp.message);

    const { error } = await supabaseAdmin.from("stock_movimentos").insert({
      catalogo_id: data.catalogo_id,
      tipo: data.tipo,
      quantidade: data.tipo === "ajuste" ? Math.abs(novo - atual) || data.quantidade : data.quantidade,
      motivo: data.motivo?.trim() || null,
      stock_apos: novo,
      utilizador_id: u.id,
      vendedor_id: vend.id,
    });
    if (error) throw new Error(error.message);

    return { ok: true, stock: novo, vendedor: vend.nome };
  });

// Resumo de movimentos por vendedor (controlo de responsabilidade no stock)
export const resumoPorVendedor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ desde: z.string().optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUser();
    let q = supabaseAdmin
      .from("stock_movimentos")
      .select("tipo, quantidade, vendedor:vendedor_id(id, nome)")
      .not("vendedor_id", "is", null);
    if (data.desde) q = q.gte("criado_em", data.desde);
    const { data: rows } = await q;
    const mapa = new Map<string, { nome: string; entradas: number; saidas: number; ajustes: number }>();
    for (const r of rows ?? []) {
      const v = r.vendedor as { id: string; nome: string } | null;
      if (!v) continue;
      const cur = mapa.get(v.id) ?? { nome: v.nome, entradas: 0, saidas: 0, ajustes: 0 };
      const qtd = Number(r.quantidade);
      if (r.tipo === "entrada") cur.entradas += qtd;
      else if (r.tipo === "saida") cur.saidas += qtd;
      else cur.ajustes += qtd;
      mapa.set(v.id, cur);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  });

