import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

function mensagem(error: unknown) {
  const m = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
  // Erros de rede/sessão têm mensagens técnicas — traduzimos para algo útil.
  if (/failed to fetch|networkerror/i.test(m)) return "Sem ligação ao servidor. Verifique a internet.";
  if (/unauthorized|sessão/i.test(m)) return "Sessão expirada. Entre novamente.";
  return m;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
    // Qualquer erro de escrita/leitura passa a aparecer como aviso, nunca como ecrã branco.
    mutationCache: new MutationCache({
      onError: (error) => toast.error(mensagem(error)),
    }),
    queryCache: new QueryCache({
      onError: (error) => toast.error(mensagem(error)),
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
