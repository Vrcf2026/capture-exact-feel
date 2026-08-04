import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Auth é custom (sessão por cookie), não Supabase Auth:
// Não importar nem registar attachSupabaseAuth neste ficheiro. Esse middleware
// tenta iniciar Supabase Auth no browser, mas esta app autentica exclusivamente
// através das server functions e do cookie httpOnly vrcf-session.

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
