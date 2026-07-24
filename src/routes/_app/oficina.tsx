import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/_app/oficina")({
  head: () => ({
    meta: [
      { title: "Oficina — VRCF" },
      { name: "description", content: "Ordens de serviço da oficina (em breve)." },
    ],
  }),
  component: OficinaPage,
});

function OficinaPage() {
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-4">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Módulo Oficina</h1>
      <p className="text-sm text-muted-foreground">
        Ordens de serviço, orçamentos, assinaturas digitais e PDFs vêm na próxima fase.
        Por agora, o núcleo da Loja está pronto para operar.
      </p>
    </div>
  );
}
