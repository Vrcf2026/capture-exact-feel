import { STATUS_ORDER, type ChecklistItem, type StatusOS } from "./oficina.functions";

export type OSRow = Record<string, unknown>;

export function checklistCompleto(checklist: unknown) {
  if (!Array.isArray(checklist) || checklist.length === 0) return false;
  return (checklist as ChecklistItem[]).every((it) => it && it.status !== null && it.status !== undefined);
}

const preenchido = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/**
 * Transições automáticas de estado (como no vrcftecnica original).
 * Só avançam — nunca recuam — e ficam desligadas se auto_status_locked estiver ativo.
 */
export function proximoStatusAuto(os: OSRow, temItens: boolean): StatusOS | null {
  if (os['auto_status_locked']) return null;
  const atual = os['status'] as StatusOS;
  if (atual === "entregue" || atual === "nao_aprovado" || atual === "sem_reparacao") return null;

  let alvo: StatusOS = atual;
  if (preenchido(os['diagnostico_tecnico'])) alvo = "diagnostico";
  if (temItens || Number(os['valor_estimado'] ?? 0) > 0) alvo = "orcamento";
  if (preenchido(os['aprovado_por']) || preenchido(os['data_aprovacao'])) alvo = "aprovado";
  if (preenchido(os['relatorio_intervencao'])) alvo = "concluido";

  const idxAtual = STATUS_ORDER.indexOf(atual);
  const idxAlvo = STATUS_ORDER.indexOf(alvo);
  return idxAlvo > idxAtual ? alvo : null;
}

/** Cliente rápido (dados mínimos) obriga a checklist de entrada preenchido antes de avançar. */
export function validarClienteRapido(os: OSRow, novoStatus: StatusOS) {
  if (novoStatus === "recebido") return;
  const dadosIncompletos =
    !!os['cliente_rapido'] ||
    !preenchido(os['contacto']) ||
    !preenchido(os['equipamento']) ||
    !preenchido(os['marca_modelo']);
  if (dadosIncompletos && !checklistCompleto(os['checklist'])) {
    throw new Error(
      "Cliente rápido / dados incompletos: preencha o checklist de entrada (todos os itens) antes de avançar o estado.",
    );
  }
}
