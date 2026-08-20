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
    const u = await requireUser();

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
    });
    if (error) throw new Error(error.message);

    return { ok: true, stock: novo };
  });
