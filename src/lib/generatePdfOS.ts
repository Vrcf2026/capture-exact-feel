import jsPDF from "jspdf";
import type { ChecklistItem } from "./oficina.functions";

export type PDFType = "diagnostico" | "orcamento" | "completo" | "full";

// Termos legais — texto exato do vrcftecnica original. Não alterar sem confirmar com o Valter.
const TERMS = [
  "1. Limitação de Testes: Defeitos em componentes não testados por impossibilidade técnica na entrada (ex: PC não ligar) não são responsabilidade da loja.",
  "2. Dados: O backup é responsabilidade exclusiva do cliente. Não nos responsabilizamos por perda de dados.",
  "3. Garantia de Software: Limitada à instalação física. Vírus, software pirata ou mau uso anulam a garantia.",
  "4. Levantamento: Prazo máximo de 90 dias após aviso de conclusão, sob pena de perda do bem (Art. 1323º CC).",
  "5. RGPD: O cliente autoriza o tratamento dos dados acima para fins exclusivos de gestão deste serviço.",
];

const QUOTE_TERMS = [
  "1. Validade: O presente orçamento é válido por 15 dias úteis a contar da data de emissão, salvo ruptura de stock.",
  "2. IVA: Todos os valores apresentados incluem IVA à taxa legal em vigor.",
  "3. Garantia: A reparação tem garantia de 90 dias sobre a mão-de-obra e peças aplicadas, exceto em caso de mau uso.",
  "4. Dados: O backup de dados é responsabilidade exclusiva do cliente. Não nos responsabilizamos por perda de dados durante a intervenção.",
  "5. Prazo de Execução: O prazo estimado de reparação é de 5 a 10 dias úteis após aprovação, sujeito a disponibilidade de peças.",
  "6. Pagamento: O pagamento é devido na totalidade no ato de levantamento do equipamento.",
  "7. RGPD: O cliente autoriza o tratamento dos dados acima para fins exclusivos de gestão deste serviço.",
];

// Guardar de forma compatível com telefones/tablets: em iOS/Android o doc.save()
// pode ser bloqueado, por isso abrimos o blob numa nova janela como alternativa.
function savePdf(doc: jsPDF, fileName: string) {
  try {
    const blob = doc.output("blob") as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    try {
      savePdf(doc, fileName);
    } catch {
      const url = URL.createObjectURL(doc.output("blob") as Blob);
      window.open(url, "_blank");
    }
  }
}

const PDF_TYPE_LABELS: Record<PDFType, string> = {
  diagnostico: "Receção / Diagnóstico",
  orcamento: "Orçamento",
  completo: "Completo",
  full: "Full",
};

interface Company {
  nome?: string | null;
  morada?: string | null;
  nif?: string | null;
  contacto?: string | null;
  email?: string | null;
  logo_url?: string | null;
}

interface Item {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
}

interface Anexo {
  nome: string;
  tipo: string;
  url: string | null;
}

export interface OSParaPdf {
  numero: number;
  cliente_nome: string | null;
  contacto: string | null;
  equipamento: string | null;
  marca_modelo: string | null;
  num_serie: string | null;
  password_pin: string | null;
  checklist: ChecklistItem[];
  acessorios: string[];
  sintomas_cliente: string | null;
  data_rececao: string;
  diagnostico_tecnico: string | null;
  aprovado_por: string | null;
  meio_aprovacao: string | null;
  data_aprovacao: string | null;
  prazo_estimado: string | null;
  relatorio_intervencao: string | null;
  limpeza_efetuada: boolean;
  testes_finais_ok: boolean;
  data_entrega: string | null;
  valor_total_pago: number | null;
  observacoes: string | null;
  observacoes_incluir_pdf: boolean;
  assinatura_rececao: string | null;
  assinatura_entrega: string | null;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ptDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("pt-PT") : "";
}

function addCompanyHeader(doc: jsPDF, company: Company, margin: number, contentW: number, startY: number): number {
  let y = startY;
  const hasCompany = company.nome || company.logo_url;
  if (hasCompany) {
    let logoWidth = 0;
    if (company.logo_url) {
      try {
        doc.addImage(company.logo_url, "PNG", margin, y, 20, 20);
        logoWidth = 24;
      } catch {
        /* skip */
      }
    }
    const textX = margin + logoWidth;
    if (company.nome) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(36, 41, 61);
      doc.text(company.nome, textX, y + 6);
    }
    const infoY = y + 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const infoParts = [company.morada, company.nif ? `NIF: ${company.nif}` : "", company.contacto, company.email].filter(Boolean);
    if (infoParts.length > 0) doc.text(infoParts.join(" · "), textX, infoY);
    y += 24;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    y += 5;
  }
  return y;
}

export async function generatePdfOS(
  os: OSParaPdf,
  itens: Item[],
  anexos: Anexo[],
  company: Company,
  pdfType: PDFType = "completo",
  options?: { skipDownload?: boolean },
): Promise<{ blob: Blob; fileName: string }> {
  if (pdfType === "orcamento") return generateQuotePDF(os, itens, company, options);

  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };

  const addTitle = (text: string) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(36, 41, 61);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, contentW, 7, "F");
    doc.text(text, margin + 3, y + 5);
    y += 10;
    doc.setTextColor(30, 30, 30);
  };

  const addRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    const maxValueW = contentW - 52;
    const valLines = doc.splitTextToSize(value || "—", maxValueW);
    for (let i = 0; i < valLines.length; i++) {
      if (i > 0) checkPage(6);
      doc.text(valLines[i], margin + 50, y + 4);
      if (i < valLines.length - 1) y += 5;
    }
    y += 6;
  };

  y = addCompanyHeader(doc, company, margin, contentW, y);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(36, 41, 61);
  const titleSuffix = pdfType !== "completo" ? ` — ${PDF_TYPE_LABELS[pdfType]}` : "";
  doc.text(`ORDEM DE SERVIÇO Nº ${os.numero}${titleSuffix}`, margin, y + 6);
  y += 14;

  addTitle("1. DADOS DO CLIENTE E EQUIPAMENTO");
  addRow("Cliente", os.cliente_nome ?? "");
  addRow("Contacto", os.contacto ?? "");
  addRow("Equipamento", os.equipamento ?? "");
  addRow("Marca/Modelo", os.marca_modelo ?? "");
  addRow("Nº de Série", os.num_serie ?? "");
  addRow("Password/PIN", os.password_pin ?? "");
  y += 3;

  const filledChecklist = (os.checklist ?? []).filter((item) => item.status !== null || item.notas);
  if (filledChecklist.length > 0) {
    checkPage(20 + filledChecklist.length * 7);
    addTitle("2. CHECKLIST DE ENTRADA");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Item", margin + 2, y + 4);
    doc.text("Estado", margin + 70, y + 4);
    doc.text("Notas", margin + 95, y + 4);
    y += 6;
    doc.setFont("helvetica", "normal");
    for (const item of filledChecklist) {
      checkPage(7);
      const itemLines = doc.splitTextToSize(item.item, 65);
      doc.text(itemLines[0], margin + 2, y + 4);
      const statusText = item.status === "ok" ? "OK" : item.status === "defeito" ? "Defeito" : item.status === "na" ? "N/A" : "—";
      if (item.status === "defeito") doc.setTextColor(220, 50, 50);
      else if (item.status === "ok") doc.setTextColor(34, 139, 34);
      doc.text(statusText, margin + 70, y + 4);
      doc.setTextColor(30, 30, 30);
      const notaMaxW = contentW - 97;
      const notaLines = doc.splitTextToSize(item.notas || "", notaMaxW);
      doc.text(notaLines[0] || "", margin + 95, y + 4);
      for (let i = 1; i < notaLines.length; i++) {
        y += 5;
        checkPage(5);
        doc.text(notaLines[i], margin + 95, y + 4);
      }
      y += 6;
    }
  }
  if ((os.acessorios ?? []).length > 0) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Acessórios: ", margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    const accMaxW = contentW - 32;
    const accLines = doc.splitTextToSize(os.acessorios.join(", "), accMaxW);
    for (let i = 0; i < accLines.length; i++) {
      doc.text(accLines[i], margin + 30, y + 4);
      if (i < accLines.length - 1) {
        y += 5;
        checkPage(5);
      }
    }
    y += 6;
  }
  y += 3;

  checkPage(40);
  addTitle("3. DIAGNÓSTICO INICIAL");
  addRow("Sintomas", os.sintomas_cliente ?? "");
  addRow("Data Receção", ptDate(os.data_rececao));

  if (os.assinatura_rececao) {
    checkPage(35);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Assinatura do Cliente (Receção):", margin + 2, y + 4);
    y += 6;
    try {
      doc.addImage(os.assinatura_rececao, "PNG", margin + 2, y, 60, 20);
    } catch {
      /* skip */
    }
    y += 23;
  }
  y += 3;

  if (pdfType === "diagnostico") return addTermsAndOutput(doc, os, TERMS, pdfType, margin, contentW, y, options);

  checkPage(30);
  addTitle("4. ORÇAMENTO E AUTORIZAÇÃO");
  y = addBudgetTable(doc, itens, margin, contentW, y);
  addRow("Aprovado por", os.aprovado_por ?? "");
  addRow("Meio", os.meio_aprovacao ?? "");
  addRow("Data Aprovação", ptDate(os.data_aprovacao));
  y += 3;

  checkPage(25);
  addTitle("5. RELATÓRIO DE INTERVENÇÃO");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(os.relatorio_intervencao || "—", contentW - 4);
  for (const line of lines) {
    checkPage(6);
    doc.text(line, margin + 2, y + 4);
    y += 5;
  }
  y += 3;

  checkPage(50);
  addTitle("6. CONTROLO DE QUALIDADE E ENTREGA");
  addRow("Limpeza Efetuada", os.limpeza_efetuada ? "Sim" : "Não");
  addRow("Testes Finais OK", os.testes_finais_ok ? "Sim" : "Não");
  addRow("Data Entrega", ptDate(os.data_entrega));
  addRow("Valor Total Pago", os.valor_total_pago ? `${os.valor_total_pago}€` : "");

  if (os.assinatura_entrega) {
    checkPage(35);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Assinatura de Levantamento (Conforme):", margin + 2, y + 4);
    y += 6;
    try {
      doc.addImage(os.assinatura_entrega, "PNG", margin + 2, y, 60, 20);
    } catch {
      /* skip */
    }
    y += 23;
  }
  y += 5;

  if ((os.observacoes_incluir_pdf || pdfType === "full") && os.observacoes) {
    checkPage(25);
    addTitle("7. OBSERVAÇÕES");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(os.observacoes, contentW - 4);
    for (const ol of obsLines) {
      checkPage(6);
      doc.text(ol, margin + 2, y + 4);
      y += 5;
    }
    y += 5;
  }

  if (pdfType === "full" && anexos.length > 0) {
    checkPage(15);
    addTitle("8. ANEXOS / FOTOS");
    for (const anexo of anexos) {
      if (anexo.tipo?.startsWith("image/") && anexo.url) {
        const imgData = await loadImageAsBase64(anexo.url).catch(() => null);
        if (imgData) {
          checkPage(80);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.text(anexo.nome, margin + 2, y + 4);
          y += 6;
          try {
            doc.addImage(imgData, "JPEG", margin + 5, y, contentW - 10, 65);
            y += 70;
          } catch {
            /* skip */
          }
        }
      } else {
        checkPage(10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`📎 ${anexo.nome}`, margin + 2, y + 4);
        y += 6;
      }
    }
    y += 3;
  }

  return addTermsAndOutput(doc, os, TERMS, pdfType, margin, contentW, y, options);
}

async function generateQuotePDF(
  os: OSParaPdf,
  itens: Item[],
  company: Company,
  options?: { skipDownload?: boolean },
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };

  y = addCompanyHeader(doc, company, margin, contentW, y);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(36, 41, 61);
  doc.text("ORÇAMENTO", margin, y + 6);
  y += 4;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const today = new Date().toLocaleDateString("pt-PT");
  doc.text(`Ref.: ORC-${os.numero}`, margin, y + 10);
  doc.text(`Data: ${today}`, margin + contentW - 40, y + 10);
  y += 16;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  doc.setTextColor(30, 30, 30);
  const halfW = contentW / 2 - 3;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 245, 250);
  doc.rect(margin, y, halfW, 7, "F");
  doc.text("DADOS DO CLIENTE", margin + 3, y + 5);
  doc.rect(margin + halfW + 6, y, halfW, 7, "F");
  doc.text("EQUIPAMENTO", margin + halfW + 9, y + 5);
  y += 10;

  const clientY = y;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Nome:", margin + 2, clientY);
  doc.setFont("helvetica", "normal");
  doc.text(os.cliente_nome || "—", margin + 20, clientY);
  doc.setFont("helvetica", "bold");
  doc.text("Contacto:", margin + 2, clientY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(os.contacto || "—", margin + 20, clientY + 5);

  const eqX = margin + halfW + 8;
  doc.setFont("helvetica", "bold");
  doc.text("Tipo:", eqX, clientY);
  doc.setFont("helvetica", "normal");
  doc.text(os.equipamento || "—", eqX + 22, clientY);
  doc.setFont("helvetica", "bold");
  doc.text("Marca/Modelo:", eqX, clientY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(os.marca_modelo || "—", eqX + 22, clientY + 5);
  doc.setFont("helvetica", "bold");
  doc.text("Nº Série:", eqX, clientY + 10);
  doc.setFont("helvetica", "normal");
  doc.text(os.num_serie || "—", eqX + 22, clientY + 10);

  y = clientY + 16;

  if (os.sintomas_cliente) {
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y, contentW, 7, "F");
    doc.text("DESCRIÇÃO DO PROBLEMA", margin + 3, y + 5);
    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const sympLines = doc.splitTextToSize(os.sintomas_cliente, contentW - 4);
    for (const line of sympLines) {
      checkPage(5);
      doc.text(line, margin + 2, y + 3);
      y += 5;
    }
    y += 4;
  }

  checkPage(30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(36, 41, 61);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW, 8, "F");
  doc.text("DESCRIÇÃO DOS SERVIÇOS E PEÇAS", margin + 3, y + 5.5);
  y += 10;
  doc.setTextColor(30, 30, 30);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(230, 232, 240);
  doc.rect(margin, y, contentW, 7, "F");
  doc.text("#", margin + 2, y + 5);
  doc.text("Descrição", margin + 10, y + 5);
  doc.text("Qtd.", margin + 100, y + 5);
  doc.text("Preço Unit.", margin + 118, y + 5);
  doc.text("Total", margin + 150, y + 5);
  y += 8;

  let subtotal = 0;
  if (itens.length > 0) {
    doc.setFont("helvetica", "normal");
    itens.forEach((it, idx) => {
      checkPage(7);
      const lineTotal = it.quantidade * it.preco_unitario;
      subtotal += lineTotal;
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y - 1, contentW, 7, "F");
      }
      doc.text(String(idx + 1), margin + 2, y + 4);
      doc.text(it.descricao || "—", margin + 10, y + 4);
      doc.text(String(it.quantidade), margin + 103, y + 4);
      doc.text(it.preco_unitario.toFixed(2) + " €", margin + 118, y + 4);
      doc.text(lineTotal.toFixed(2) + " €", margin + 150, y + 4);
      y += 7;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("Sem itens registados.", margin + 2, y + 4);
    y += 7;
  }

  checkPage(18);
  doc.setDrawColor(36, 41, 61);
  doc.setLineWidth(0.5);
  doc.line(margin + 95, y, margin + contentW, y);
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", margin + 118, y + 4);
  doc.text(subtotal.toFixed(2) + " €", margin + 150, y + 4);
  y += 10;

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text("Valores com IVA incluído à taxa legal em vigor.", margin + 2, y);
  doc.setTextColor(30, 30, 30);
  y += 8;

  if (os.prazo_estimado) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Prazo estimado de entrega: ${ptDate(os.prazo_estimado)}`, margin + 2, y);
    y += 7;
  }

  checkPage(50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(36, 41, 61);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW, 7, "F");
  doc.text("TERMOS E CONDIÇÕES", margin + 3, y + 5);
  y += 10;
  doc.setTextColor(30, 30, 30);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  for (const term of QUOTE_TERMS) {
    checkPage(12);
    const tLines = doc.splitTextToSize(term, contentW - 4);
    for (const tl of tLines) {
      checkPage(5);
      doc.text(tl, margin + 2, y + 3);
      y += 4;
    }
    y += 1.5;
  }
  y += 6;

  checkPage(25);
  doc.setDrawColor(36, 41, 61);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(36, 41, 61);
  doc.text("COMO RESPONDER A ESTE ORÇAMENTO:", margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const meioText = os.meio_aprovacao
    ? `Para aprovar ou recusar este orçamento, responda pelo mesmo meio em que o recebeu (${os.meio_aprovacao}).`
    : "Para aprovar ou recusar este orçamento, responda pelo mesmo meio em que o recebeu.";
  const responseLines = doc.splitTextToSize(meioText, contentW - 6);
  let ry = y + 9;
  for (const rl of responseLines) {
    doc.text(rl, margin + 3, ry);
    ry += 3.5;
  }
  doc.text("Em caso de não resposta no prazo de validade, o orçamento será considerado recusado.", margin + 3, ry);

  y = 284;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentW, y);
  y += 3;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  const footerParts = [company.nome, company.contacto, company.email].filter(Boolean);
  if (footerParts.length > 0) doc.text(footerParts.join(" · "), W / 2, y + 2, { align: "center" });
  doc.text(`Documento gerado em ${today}`, W / 2, y + 6, { align: "center" });

  const fileName = `Orcamento_${os.numero}_${os.cliente_nome || "sem_nome"}.pdf`;
  if (!options?.skipDownload) savePdf(doc, fileName);
  return { blob: doc.output("blob") as Blob, fileName };
}

function addBudgetTable(doc: jsPDF, itens: Item[], margin: number, contentW: number, startY: number): number {
  let y = startY;
  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };
  if (itens.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Descrição", margin + 2, y + 4);
    doc.text("Qtd.", margin + 85, y + 4);
    doc.text("Preço Unit.", margin + 100, y + 4);
    doc.text("Total", margin + 130, y + 4);
    y += 6;
    doc.setFont("helvetica", "normal");
    let subtotal = 0;
    for (const it of itens) {
      checkPage(7);
      const lineTotal = it.quantidade * it.preco_unitario;
      subtotal += lineTotal;
      doc.text(it.descricao || "—", margin + 2, y + 4);
      doc.text(String(it.quantidade), margin + 85, y + 4);
      doc.text(it.preco_unitario.toFixed(2) + "€", margin + 100, y + 4);
      doc.text(lineTotal.toFixed(2) + "€", margin + 130, y + 4);
      y += 6;
    }
    checkPage(12);
    doc.setDrawColor(30, 30, 30);
    doc.line(margin + 2, y, margin + contentW - 2, y);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL:", margin + 100, y + 4);
    doc.text(subtotal.toFixed(2) + "€", margin + 130, y + 4);
    y += 7;
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("IVA incluído à taxa legal em vigor. Orçamento válido por 15 dias, excepto ruptura de stock.", margin + 2, y + 4);
    y += 6;
  }
  return y;
}

function addTermsAndOutput(
  doc: jsPDF,
  os: OSParaPdf,
  terms: string[],
  pdfType: PDFType,
  margin: number,
  contentW: number,
  startY: number,
  options?: { skipDownload?: boolean },
): { blob: Blob; fileName: string } {
  let y = startY;
  const check = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };
  check(50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(36, 41, 61);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW, 7, "F");
  doc.text("TERMOS E CONDIÇÕES", margin + 3, y + 5);
  y += 10;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  for (const term of terms) {
    check(12);
    const tLines = doc.splitTextToSize(term, contentW - 4);
    for (const tl of tLines) {
      check(5);
      doc.text(tl, margin + 2, y + 4);
      y += 4.5;
    }
    y += 2;
  }
  const typeLabel = PDF_TYPE_LABELS[pdfType];
  const fileName = `Ordem_${os.numero}_${typeLabel}_${os.cliente_nome || "sem_nome"}.pdf`;
  if (!options?.skipDownload) savePdf(doc, fileName);
  return { blob: doc.output("blob") as Blob, fileName };
}
