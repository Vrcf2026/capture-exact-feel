import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

export type Papel = "admin" | "operador" | "tecnico";

export interface CurrentUser {
  id: string;
  nome: string;
  papel: Papel;
  acesso_loja: boolean;
  acesso_oficina: boolean;
  ativo: boolean;
}

const loginSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sessionConfig } = await import("./auth.server");
    const { data: u } = await supabaseAdmin
      .from("utilizadores")
      .select("id, nome, password_hash, papel, acesso_loja, acesso_oficina, ativo")
      .ilike("nome", data.nome)
      .maybeSingle();
    if (!u || !u.ativo) return { ok: false as const, error: "Credenciais inválidas." };
    const ok = await bcrypt.compare(data.password, u.password_hash);
    if (!ok) return { ok: false as const, error: "Credenciais inválidas." };
    const session = await useSession(sessionConfig());
    await session.update({ userId: u.id });
    return {
      ok: true as const,
      user: {
        id: u.id,
        nome: u.nome,
        papel: u.papel as Papel,
        acesso_loja: u.acesso_loja,
        acesso_oficina: u.acesso_oficina,
        ativo: u.ativo,
      } satisfies CurrentUser,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { sessionConfig } = await import("./auth.server");
  const session = await useSession(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const whoAmI = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./auth.server");
  const u = await getSessionUser();
  return u;
});

const changeSchema = z.object({
  atual: z.string().min(1),
  nova: z.string().min(6).max(200),
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => changeSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = await requireUser();
    const { data: row } = await supabaseAdmin
      .from("utilizadores")
      .select("password_hash")
      .eq("id", u.id)
      .single();
    if (!row) throw new Error("Utilizador não encontrado.");
    const ok = await bcrypt.compare(data.atual, row.password_hash);
    if (!ok) return { ok: false as const, error: "Password atual incorreta." };
    const hash = await bcrypt.hash(data.nova, 10);
    await supabaseAdmin.from("utilizadores").update({ password_hash: hash }).eq("id", u.id);
    return { ok: true as const };
  });
