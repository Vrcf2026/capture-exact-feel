import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ============ CATÁLOGO ============
export const listCatalogo = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();
  const { data } = await supabaseAdmin
    .from("catalogo")
    .select("*")
    .order("nome");
  return data ?? [];
});

const catSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().trim().max(40).optional().nullable(),
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(["produto", "servico"]),
  preco: z.number().min(0),
  preco2: z.number().min(0).default(0),
  unidade: z.string().trim().min(1).default("unidade"),
  ativo: z.boolean().default(true),
  controla_stock: z.boolean().default(false),
  stock: z.number().min(0).default(0),
  stock_minimo: z.number().min(0).default(0),
});


export const upsertCatalogo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => catSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    const { id, stock, ...rest } = data;
    const payload = { ...rest, codigo: rest.codigo?.trim() ? rest.codigo.trim() : null };
    if (id) {
      // O stock atual só muda por movimentos (entradas/saídas), nunca na edição do artigo.
      const { error } = await supabaseAdmin.from("catalogo").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const stockInicial = payload.controla_stock ? stock : 0;
      const { data: row, error } = await supabaseAdmin
        .from("catalogo")
        .insert({ ...payload, stock: stockInicial })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (stockInicial > 0) {
        const u = await requireAdmin();
        await supabaseAdmin.from("stock_movimentos").insert({
          catalogo_id: row.id,
          tipo: "entrada",
          quantidade: stockInicial,
          motivo: "Stock inicial",
          stock_apos: stockInicial,
          utilizador_id: u.id,
        });
      }
      return { id: row.id };
    }
  });


export const deleteCatalogo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    // Soft-delete: desativar (não apagar, para preservar histórico de vendas/OS).
    const { error } = await supabaseAdmin.from("catalogo").update({ ativo: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CLIENTES ============
export const listClientes = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();
  const { data } = await supabaseAdmin.from("clientes").select("*").order("nome");
  return data ?? [];
});

const cliSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(200),
  nif: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  linha_preco: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const upsertCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cliSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    const payload = {
      nome: data.nome,
      nif: data.nif || null,
      telefone: data.telefone || null,
      email: data.email || null,
      linha_preco: data.linha_preco,
    };

    if (data.id) {
      await supabaseAdmin.from("clientes").update(payload).eq("id", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("clientes").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireLoja } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireLoja();
    const { count } = await supabaseAdmin
      .from("registos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.id);
    if (count && count > 0) {
      throw new Error(`Este cliente tem ${count} venda(s) associada(s) e não pode ser eliminado.`);
    }
    const { error } = await supabaseAdmin.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ VENDEDORES ============
export const confirmarVendedorAcesso = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ vendedor_id: z.string().uuid(), pin: z.string().regex(/^\d{4,8}$/, "PIN inválido.") }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUser();
    const { data: v } = await supabaseAdmin
      .from("vendedores")
      .select("id, nome, pin_hash, ativo")
      .eq("id", data.vendedor_id)
      .maybeSingle();
    if (!v || !v.ativo) return { ok: false as const, error: "Vendedor inválido." };
    const ok = await bcrypt.compare(data.pin, v.pin_hash);
    if (!ok) return { ok: false as const, error: "PIN incorreto." };
    return { ok: true as const, id: v.id, nome: v.nome };
  });

export const listVendedores = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();
  const { data } = await supabaseAdmin
    .from("vendedores")
    .select("id, nome, ativo, created_at")
    .order("nome");
  return data ?? [];
});

const venSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  ativo: z.boolean().default(true),
});

export const upsertVendedor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => venSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    if (data.id) {
      const pin_hash = data.pin ? await bcrypt.hash(data.pin, 10) : undefined;
      await supabaseAdmin
        .from("vendedores")
        .update({ nome: data.nome, ativo: data.ativo, ...(pin_hash ? { pin_hash } : {}) })
        .eq("id", data.id);
      return { id: data.id };
    }
    if (!data.pin) throw new Error("PIN obrigatório para novo vendedor.");
    const pin_hash = await bcrypt.hash(data.pin, 10);
    const { data: row, error } = await supabaseAdmin
      .from("vendedores")
      .insert({ nome: data.nome, ativo: data.ativo, pin_hash })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ============ UTILIZADORES ============
export const listUtilizadores = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("utilizadores")
    .select("id, nome, papel, acesso_loja, acesso_oficina, ativo, created_at")
    .order("nome");
  return data ?? [];
});

const utilSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(60),
  password: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z
      .string()
      .min(6, "A password tem de ter pelo menos 6 caracteres.")
      .max(200)
      .optional()),
  papel: z.enum(["admin", "operador", "tecnico"]),
  acesso_loja: z.boolean(),
  acesso_oficina: z.boolean(),
  ativo: z.boolean(),
});

export const upsertUtilizador = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => utilSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    if (data.id) {
      const password_hash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
      await supabaseAdmin
        .from("utilizadores")
        .update({
          nome: data.nome,
          papel: data.papel,
          acesso_loja: data.acesso_loja,
          acesso_oficina: data.acesso_oficina,
          ativo: data.ativo,
          ...(password_hash ? { password_hash } : {}),
        })
        .eq("id", data.id);
      return { id: data.id };
    }
    if (!data.password) throw new Error("Password obrigatória para novo utilizador.");
    const password_hash = await bcrypt.hash(data.password, 10);
    const { data: row, error } = await supabaseAdmin
      .from("utilizadores")
      .insert({
        nome: data.nome,
        password_hash,
        papel: data.papel,
        acesso_loja: data.acesso_loja,
        acesso_oficina: data.acesso_oficina,
        ativo: data.ativo,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ============ COMPANY SETTINGS ============
export const getCompany = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await requireUser();
  const { data } = await supabaseAdmin.from("company_settings").select("*").eq("id", true).maybeSingle();
  return data;
});

const compSchema = z.object({
  nome: z.string().trim().max(200).optional().nullable(),
  morada: z.string().trim().max(400).optional().nullable(),
  nif: z.string().trim().max(20).optional().nullable(),
  contacto: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  logo_url: z.string().trim().max(500000).optional().nullable(),
});

export const updateCompany = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => compSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin();
    await supabaseAdmin
      .from("company_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", true);
    return { ok: true };
  });
