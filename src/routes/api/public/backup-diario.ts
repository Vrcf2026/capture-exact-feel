import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const recebido = request.headers.get("x-backup-secret");
        if (!recebido) return new Response("Não autorizado", { status: 401 });

        let valido = recebido === process.env["BACKUP_CRON_SECRET"];
        if (!valido) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("backup_cron").select("token").maybeSingle();
          valido = !!data?.token && data.token === recebido;
        }
        if (!valido) return new Response("Não autorizado", { status: 401 });

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
