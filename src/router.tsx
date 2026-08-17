import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

function mensagem(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const limpo = raw.replace(/^Error:\s*/i, "").trim();
  if (!limpo || /^\[?object/i.test(limpo) || limpo === "Unexpected token") {
    return "Não foi possível concluir a operação. Tente novamente.";
  }
  if (/failed to fetch|networkerror/i.test(limpo)) {
    return "Sem ligação ao servidor. Verifique a internet e tente outra vez.";
  }
  return limpo;
}

type MetaToast = { success?: string | false; silent?: boolean };

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1 } },
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if ((mutation.meta as MetaToast | undefined)?.silent) return;
        toast.error(mensagem(error));
      },
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const meta = mutation.meta as MetaToast | undefined;
        if (meta?.silent || meta?.success === false) return;
        toast.success(meta?.success ?? "Guardado.");
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        toast.error(mensagem(error));
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
