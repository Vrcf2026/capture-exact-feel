import { createMiddleware } from "@tanstack/react-start";

// A VRCF autentica com uma sessão própria em cookie httpOnly.
// Este middleware compatível mantém as server functions inalteradas caso a
// integração automática volte a importar o auth-attacher gerado.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => next(),
);