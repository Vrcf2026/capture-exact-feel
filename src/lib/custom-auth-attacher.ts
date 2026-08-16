import { createMiddleware } from "@tanstack/react-start";

export const SESSION_TOKEN_KEY = "vrcf-session-token";

export function setSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    else window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // storage indisponível
  }
}

function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

// A VRCF autentica com uma sessão própria. Como os cookies podem ser bloqueados
// dentro do iframe do preview (ou em browsers móveis), enviamos também um token
// assinado no cabeçalho x-vrcf-session. Este middleware substitui o attacher
// gerado do Supabase Auth, que esta app não utiliza.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = getSessionToken();
    return next(token ? { headers: { "x-vrcf-session": token } } : {});
  },
);
