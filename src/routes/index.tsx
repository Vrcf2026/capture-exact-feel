import { createFileRoute, redirect } from "@tanstack/react-router";
import { whoAmI } from "@/lib/auth.functions";

// Raiz: redireciona para app se autenticado, senão para login.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const u = await whoAmI();
    if (u) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
