import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getOS, STATUS_LABELS, type StatusOS, type ChecklistItem } from "@/lib/oficina.functions";
import { getCompany } from "@/lib/admin.functions";
import { eur, dt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_app/oficina/$id/imprimir")({
  head: () => ({ meta: [{ title: "Imprimir OS — VRCF" }] }),
  component: ImprimirOSPage,
});

function ImprimirOSPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["os", id], queryFn: () => getOS({ data: { id } }) });
  const { data: empresa } = useQuery({ queryKey: ["empresa"], queryFn: () => getCompany() });

  useEffect(() => {
    document.body.classList.add("print-mode");
    return () => document.body.classList.remove("print-mode");
  }, []);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground p-6">A carregar…</p>;
  const { os, itens } = data;
  const checklist = (os.checklist as ChecklistItem[] | null) ?? [];
  const total = itens.reduce(
    (s, it) => s + Math.round(Number(it.quantidade) * Number(it.preco_unitario) * 100) / 100,
    0,
  );

  return (
    <div className="max-w-2xl mx-auto bg-white text-black p-8 print:p-0 space-y-6 rounded-md">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="flex items-start justify-between border-b border-black/20 pb-4">
        <div>
          <h1 className="text-xl font-bold">{empresa?.nome ?? "VRCF"}</h1>
          <p className="text-xs text-black/70">{empresa?.morada ?? ""}</p>
          <p className="text-xs text-black/70">
            {empresa?.nif ? `NIF: ${empresa.nif}` : ""} {empresa?.contacto ? `· ${empresa.contacto}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">Ordem de serviço</p>
          <p className="text-2xl font-bold">#{os.numero}</p>
          <p className="text-xs text-black/70">
            {dt(os.data_rececao)} · {STATUS_LABELS[os.status as StatusOS]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold mb-1">Cliente</p>
          <p>{os.cliente_nome}</p>
          <p className="text-black/70">{os.contacto ?? ""}</p>
        </div>
        <div>
          <p className="font-semibold mb-1">Equipamento</p>
          <p>
            {os.equipamento} {os.marca_modelo ? `· ${os.marca_modelo}` : ""}
          </p>
          <p className="text-black/70">{os.num_serie ? `Nº série: ${os.num_serie}` : ""}</p>
        </div>
      </div>

      {os.sintomas_cliente && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Sintomas descritos</p>
          <p>{os.sintomas_cliente}</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Checklist de entrada</p>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {checklist.map((c) => (
                <tr key={c.item} className="border-b border-black/10">
                  <td className="py-1">{c.item}</td>
                  <td className="py-1 text-center w-16">
                    {c.status === "ok" ? "OK" : c.status === "defeito" ? "Defeito" : c.status === "na" ? "N/A" : "—"}
                  </td>
                  <td className="py-1 text-black/70">{c.notas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {os.diagnostico_tecnico && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Diagnóstico técnico</p>
          <p className="whitespace-pre-wrap">{os.diagnostico_tecnico}</p>
        </div>
      )}

      {os.relatorio_intervencao && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Relatório de intervenção</p>
          <p className="whitespace-pre-wrap">{os.relatorio_intervencao}</p>
        </div>
      )}

      {os.observacoes_incluir_pdf && os.observacoes && (
        <div className="text-sm">
          <p className="font-semibold mb-1">Observações</p>
          <p className="whitespace-pre-wrap">{os.observacoes}</p>
        </div>
      )}

      {itens.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-black/30">
              <th className="text-left py-1">Descrição</th>
              <th className="text-right py-1">Qtd.</th>
              <th className="text-right py-1">Preço</th>
              <th className="text-right py-1">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it.id} className="border-b border-black/10">
                <td className="py-1">{it.descricao}</td>
                <td className="text-right py-1">{it.quantidade}</td>
                <td className="text-right py-1">{eur(it.preco_unitario)}</td>
                <td className="text-right py-1">{eur(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right font-semibold pt-2">
                Total
              </td>
              <td className="text-right font-semibold pt-2">{eur(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="grid grid-cols-2 gap-8 pt-8 text-sm">
        <div>
          <p className="font-semibold mb-2">Assinatura na receção</p>
          {os.assinatura_rececao ? (
            <img src={os.assinatura_rececao} alt="Assinatura receção" className="h-20" />
          ) : (
            <div className="h-20 border-b border-black/40" />
          )}
        </div>
        <div>
          <p className="font-semibold mb-2">Assinatura na entrega</p>
          {os.assinatura_entrega ? (
            <img src={os.assinatura_entrega} alt="Assinatura entrega" className="h-20" />
          ) : (
            <div className="h-20 border-b border-black/40" />
          )}
        </div>
      </div>
    </div>
  );
}
