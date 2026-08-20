import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env["BACKUP_CRON_SECRET"];
        const recebido = request.headers.get("x-backup-secret");
        if (!esperado || !recebido || recebido !== esperado) {
          return new Response("Não autorizado", { status: 401 });
        }
        try {
          const { executarBackup } = await import("@/lib/backup.server");
          const r = await executarBackup();
          return Response.json({ ok: true, ...r });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro desconhecido";
          console.error("backup-diario falhou:", msg);
          return Response.json({ ok: false, erro: msg }, { status: 500 });
        }
      },
    },
  },
});
