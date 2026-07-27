// Server-only auth helpers. Nunca importar de código client.
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Papel = "admin" | "operador" | "tecnico";

export interface SessionData {
  userId?: string;
}

export interface CurrentUser {
  id: string;
  nome: string;
  papel: Papel;
  acesso_loja: boolean;
  acesso_oficina: boolean;
  ativo: boolean;
}

export function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET em falta.");
  return {
    password,
    name: "vrcf-session",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    cookie: {
      httpOnly: true,
      secure: true,
      // "none" para a sessão funcionar dentro do iframe do preview (cross-site)
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export async function getSessionUser(): Promise<CurrentUser | null> {
  const session = await useSession<SessionData>(sessionConfig());
  const userId = session.data.userId;
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("utilizadores")
    .select("id, nome, papel, acesso_loja, acesso_oficina, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.ativo) return null;
  return data as CurrentUser;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("NÃO_AUTENTICADO");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.papel !== "admin") throw new Error("Sem permissões de administrador.");
  return u;
}

export async function requireLoja(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.acesso_loja && u.papel !== "admin")
    throw new Error("Sem acesso ao módulo Loja.");
  return u;
}

export async function requireOficina(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.acesso_oficina && u.papel !== "admin")
    throw new Error("Sem acesso ao módulo Oficina.");
  return u;
}
