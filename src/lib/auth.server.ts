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
  deve_trocar_password: boolean;
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

// ---- Token de sessão alternativo (para quando os cookies são bloqueados no iframe/mobile)
const enc = new TextEncoder();

async function hmac(payload: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET em falta.");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "");
}

export async function createSessionToken(userId: string): Promise<string> {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

async function userIdFromToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!userId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmac(`${userId}.${exp}`);
  if (expected !== sig) return null;
  return userId;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const header = getRequestHeader("x-vrcf-session" as never) as string | undefined;
    if (header) {
      const id = await userIdFromToken(header);
      if (id) return id;
    }
  } catch {
    // sem request context (build/prerender) — segue para o cookie
  }
  const session = await useSession<SessionData>(sessionConfig());
  return session.data.userId ?? null;
}

export async function getSessionUser(): Promise<CurrentUser | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("utilizadores")
    .select("id, nome, papel, acesso_loja, acesso_oficina, ativo, deve_trocar_password")
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
