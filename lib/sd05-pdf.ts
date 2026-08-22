import "server-only";
import type { SD05Content } from "@/lib/sd-stage-content";

export type SD05PdfSignature = {
  signerName: string;
  signerEmail: string;
  signerRole?: string | null;
  signerOrganization?: string | null;
  signatureName?: string | null;
  signatureMode?: "typed" | "drawn" | null;
  signedAt?: string | null;
  contractHash?: string | null;
  signedPayloadHash?: string | null;
  initials?: Record<string, string> | null;
};

type Font = "F1" | "F2" | "F3";
type TextAlign = "left" | "center" | "right";
type Page = { commands: string[] };
type BlockKind = "major" | "article" | "h2" | "h3" | "h4" | "subsection" | "bullet" | "table" | "paragraph";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 46;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const PURPLE = "0.451 0.365 0.953";
const PURPLE_DARK = "0.365 0.286 0.863";
const TEXT = "0.200 0.200 0.200";
const MUTED = "0.420 0.455 0.510";
const BORDER = "0.855 0.875 0.910";
const LIGHT = "0.972 0.976 0.984";

function normalizePdfText(value: string) {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/€/g, "EUR")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function escapePdf(value: string) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function approximateWidth(value: string, size: number) {
  return normalizePdfText(value).length * size * 0.51;
}

function textCommand(text: string, x: number, y: number, size = 10, font: Font = "F1", color = TEXT, align: TextAlign = "left") {
  let tx = x;
  const width = approximateWidth(text, size);
  if (align === "center") tx -= width / 2;
  if (align === "right") tx -= width;
  return `${color} rg BT /${font} ${size} Tf 1 0 0 1 ${tx.toFixed(1)} ${y.toFixed(1)} Tm (${escapePdf(text)}) Tj ET`;
}

function rectCommand(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, lineWidth = 1) {
  const parts = ["q"];
  if (fill) parts.push(`${fill} rg`);
  if (stroke) parts.push(`${stroke} RG ${lineWidth} w`);
  parts.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re`);
  parts.push(fill && stroke ? "B" : fill ? "f" : "S", "Q");
  return parts.join(" ");
}

function circleCommands(cx: number, cy: number, radius: number, fill: string, stroke?: string) {
  const k = radius * 0.5522847498;
  const p = [
    `${(cx + radius).toFixed(1)} ${cy.toFixed(1)} m`,
    `${(cx + radius).toFixed(1)} ${(cy + k).toFixed(1)} ${(cx + k).toFixed(1)} ${(cy + radius).toFixed(1)} ${cx.toFixed(1)} ${(cy + radius).toFixed(1)} c`,
    `${(cx - k).toFixed(1)} ${(cy + radius).toFixed(1)} ${(cx - radius).toFixed(1)} ${(cy + k).toFixed(1)} ${(cx - radius).toFixed(1)} ${cy.toFixed(1)} c`,
    `${(cx - radius).toFixed(1)} ${(cy - k).toFixed(1)} ${(cx - k).toFixed(1)} ${(cy - radius).toFixed(1)} ${cx.toFixed(1)} ${(cy - radius).toFixed(1)} c`,
    `${(cx + k).toFixed(1)} ${(cy - radius).toFixed(1)} ${(cx + radius).toFixed(1)} ${(cy - k).toFixed(1)} ${(cx + radius).toFixed(1)} ${cy.toFixed(1)} c`,
  ].join(" ");
  return `q ${fill} rg ${stroke ? `${stroke} RG 1 w ` : ""}${p} ${stroke ? "B" : "f"} Q`;
}

function wrap(value: string, width: number, size: number) {
  const maxChars = Math.max(12, Math.floor(width / Math.max(4.2, size * 0.52)));
  const result: string[] = [];
  for (const sourceLine of normalizePdfText(value).split(/\n/)) {
    const words = sourceLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { result.push(""); continue; }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) { result.push(current); current = word; }
      else current = next;
    }
    if (current) result.push(current);
  }
  return result.length ? result : [""];
}

function blockKind(raw: string): BlockKind {
  const value = raw.trim();
  if (/^(?:H2:\s*|##\s+)/i.test(value)) return "h2";
  if (/^(?:H3:\s*|###\s+)/i.test(value)) return "h3";
  if (/^(?:H4:\s*|####\s+)/i.test(value)) return "h4";
  if (/^(PRÉAMBULE|PREAMBULE|ENTRÉE EN VIGUEUR|ENTREE EN VIGUEUR|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE ET JURIDICTION)$/i.test(value)) return "major";
  if (/^(ARTICLE\s+\d+|ANNEXE\s+\d+)/i.test(value)) return "article";
  if (/^\d+\.\d+\.?\s+/i.test(value)) return "subsection";
  if (/^(?:[-–•]\s+)/.test(value)) return "bullet";
  if (/^\|.*\|$/.test(value)) return "table";
  return "paragraph";
}

function displayText(raw: string) {
  return raw.trim().replace(/^(?:H2:|H3:|H4:)\s*/i, "").replace(/^#{2,4}\s+/, "").trim();
}

function renderBlocks(raw: string) {
  const result: Array<{ kind: BlockKind; text: string }> = [];
  let paragraph: string[] = [];
  let table: string[] = [];
  const flushParagraph = () => { if (paragraph.length) result.push({ kind: "paragraph", text: paragraph.join("\n") }); paragraph = []; };
  const flushTable = () => { if (table.length) result.push({ kind: "table", text: table.join("\n") }); table = []; };
  for (const line of String(raw || "").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); flushTable(); continue; }
    const kind = blockKind(trimmed);
    if (kind === "table") { flushParagraph(); table.push(trimmed); continue; }
    flushTable();
    if (kind === "paragraph") paragraph.push(trimmed);
    else { flushParagraph(); result.push({ kind, text: displayText(trimmed) }); }
  }
  flushParagraph(); flushTable();
  return result;
}

function dateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined });
}

export function buildBrandedSD05Pdf(input: { content: SD05Content; companyName: string; signatures?: SD05PdfSignature[] }) {
  const { content, companyName } = input;
  const signatures = input.signatures || [];
  const pages: Page[] = [];
  const legal = content.contractTemplate === "legal_convention";
  const band = legal ? "0.196 0.196 0.196" : PURPLE;
  let current: Page;
  let y = 0;

  const newPage = () => {
    current = { commands: [] };
    pages.push(current);
    current.commands.push(rectCommand(0, PAGE_H - 34, PAGE_W, 34, band));
    current.commands.push(circleCommands(PAGE_W / 2, PAGE_H - 34, 20, "1 1 1", band));
    current.commands.push(textCommand("G", PAGE_W / 2, PAGE_H - 40, 15, "F2", legal ? "0.196 0.196 0.196" : PURPLE, "center"));
    y = PAGE_H - 74;
  };

  const ensure = (height: number) => { if (y - height < 82) newPage(); };
  const drawWrapped = (value: string, options: { x?: number; width?: number; size?: number; font?: Font; color?: string; lineHeight?: number; gapBefore?: number; align?: TextAlign } = {}) => {
    const x = options.x ?? MARGIN_X;
    const width = options.width ?? CONTENT_W;
    const size = options.size ?? 9.2;
    const lineHeight = options.lineHeight ?? size * 1.42;
    const lines = wrap(value, width, size);
    const height = (options.gapBefore || 0) + lines.length * lineHeight;
    ensure(height + 3);
    y -= options.gapBefore || 0;
    for (const line of lines) {
      const anchor = options.align === "center" ? x + width / 2 : options.align === "right" ? x + width : x;
      current.commands.push(textCommand(line, anchor, y, size, options.font, options.color, options.align));
      y -= lineHeight;
    }
    return height;
  };

  const sectionTitle = (title: string, size = 13) => {
    ensure(34);
    y -= 8;
    drawWrapped(title, { size, font: "F2", color: PURPLE_DARK, lineHeight: size * 1.25 });
    y -= 3;
  };

  const infoCard = (label: string, value: string, x: number, top: number, width: number) => {
    current.commands.push(rectCommand(x, top - 46, width, 46, LIGHT, BORDER));
    current.commands.push(textCommand(label.toUpperCase(), x + 10, top - 14, 6.8, "F2", MUTED));
    const lines = wrap(value || "-", width - 20, 9.4).slice(0, 2);
    lines.forEach((line, index) => current.commands.push(textCommand(line, x + 10, top - 29 - index * 11, 9.4, index === 0 ? "F2" : "F1", TEXT)));
  };

  newPage();
  y -= 12;
  drawWrapped(legal ? "SD05 · CONVENTION JURIDIQUE" : "SD05 · CONTRAT & SIGNATURE ÉLECTRONIQUE", { size: 8, font: "F2", color: MUTED, align: "center", lineHeight: 10 });
  y -= 12;
  drawWrapped(content.contractTitle || "Contrat Gando", { size: legal ? 22 : 24, font: "F2", color: "0.07 0.09 0.13", align: "center", lineHeight: 28 });
  y -= 5;
  drawWrapped(`${content.contractReference || "Référence à compléter"} · ${content.contractVersion || "Version à compléter"}`, { size: 8.5, font: "F2", color: PURPLE, align: "center", lineHeight: 11 });
  y -= 22;

  const clientSigner = content.signatories.find(item => item.organization !== "GANDO SOLUTIONS") || content.signatories[0];
  const gandoSigner = content.signatories.find(item => item.organization === "GANDO SOLUTIONS") || content.signatories[1];

  if (legal) {
    drawWrapped("ENTRE :", { size: 8.5, font: "F2", color: PURPLE });
    y -= 3;
    drawWrapped("GANDO SOLUTIONS", { size: 11.5, font: "F2", color: "0.07 0.09 0.13" });
    drawWrapped(`SAS au capital de 1 000,00 euros · RCS Meaux 943 391 201\n3 chemin de la porte verte, 77144 Montévrain\nReprésentée par ${gandoSigner?.name || "Bilayl MATOU"}${gandoSigner?.role ? `, ${gandoSigner.role}` : ""}\ncontact@gando.app`, { size: 9, color: TEXT, lineHeight: 13 });
    y -= 15;
    drawWrapped("ET :", { size: 8.5, font: "F2", color: PURPLE });
    y -= 3;
    drawWrapped(companyName || clientSigner?.organization || "Société cliente", { size: 11.5, font: "F2", color: "0.07 0.09 0.13" });
    const clientLines = [clientSigner?.name ? `Représentée par ${clientSigner.name}` : "", clientSigner?.role || "", clientSigner?.email || ""].filter(Boolean).join("\n");
    if (clientLines) drawWrapped(clientLines, { size: 9, color: TEXT, lineHeight: 13 });
  } else {
    current.commands.push(rectCommand(MARGIN_X, y - 96, CONTENT_W, 96, "0.965 0.958 1", "0.820 0.785 1"));
    current.commands.push(textCommand("PARTENAIRE / CLIENT", MARGIN_X + 16, y - 20, 7.2, "F2", PURPLE));
    current.commands.push(textCommand(companyName || "Client", MARGIN_X + 16, y - 42, 17, "F2", "0.07 0.09 0.13"));
    current.commands.push(textCommand(clientSigner?.name || "Signataire à confirmer", MARGIN_X + 16, y - 64, 9.5, "F2", TEXT));
    current.commands.push(textCommand(clientSigner?.email || "", MARGIN_X + 16, y - 80, 8.5, "F1", MUTED));
    y -= 115;
  }

  y -= 18;
  const colGap = 8;
  const colW = (CONTENT_W - colGap) / 2;
  const top = y;
  infoCard("Mise en production", content.goLiveDate || content.effectiveDate || "À compléter", MARGIN_X, top, colW);
  infoCard("Durée initiale", content.term || "À compléter", MARGIN_X + colW + colGap, top, colW);
  y -= 54;
  infoCard("Renouvellement", content.renewal || "À compléter", MARGIN_X, y, colW);
  infoCard("Préavis / résiliation", content.terminationNotice || "À compléter", MARGIN_X + colW + colGap, y, colW);
  y -= 72;

  if (content.legalItems.length) {
    sectionTitle("CONDITIONS PARTICULIÈRES", 11.5);
    for (const item of content.legalItems) {
      ensure(36);
      current.commands.push(rectCommand(MARGIN_X, y - 29, CONTENT_W, 29, "1 1 1", BORDER));
      current.commands.push(textCommand(item.topic, MARGIN_X + 10, y - 12, 8.4, "F2", TEXT));
      current.commands.push(textCommand(item.notes || "À compléter", PAGE_W - MARGIN_X - 10, y - 12, 8, "F1", MUTED, "right"));
      y -= 34;
    }
  }

  newPage();
  sectionTitle("CONTRAT", 14);
  for (const block of renderBlocks(content.contractSummary)) {
    if (block.kind === "major" || block.kind === "article" || block.kind === "h2") {
      drawWrapped(block.text, { size: block.kind === "major" ? 12.2 : 11.5, font: "F2", color: PURPLE_DARK, lineHeight: 15, gapBefore: 8 });
      y -= 2;
      continue;
    }
    if (block.kind === "h3" || block.kind === "subsection") {
      drawWrapped(block.text, { size: 10.2, font: "F2", color: TEXT, lineHeight: 13.5, gapBefore: 5 });
      continue;
    }
    if (block.kind === "h4") {
      drawWrapped(block.text.toUpperCase(), { size: 8.7, font: "F2", color: TEXT, lineHeight: 12, gapBefore: 4 });
      continue;
    }
    if (block.kind === "bullet") {
      drawWrapped(`• ${block.text.replace(/^[-–•]\s*/, "")}`, { x: MARGIN_X + 13, width: CONTENT_W - 13, size: 9, color: TEXT, lineHeight: 13.2, gapBefore: 2 });
      continue;
    }
    if (block.kind === "table") {
      const rows = block.text.split(/\n/).map(line => line.trim()).filter(Boolean).map(line => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim()));
      const hasDivider = rows[1]?.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
      const dataRows = hasDivider ? [rows[0], ...rows.slice(2)] : rows;
      const columns = Math.max(1, ...dataRows.map(row => row.length));
      const cellW = CONTENT_W / columns;
      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
        const row = dataRows[rowIndex];
        const cellLines = Array.from({ length: columns }, (_, index) => wrap(row[index] || "", cellW - 12, 7.6).slice(0, 4));
        const rowH = Math.max(24, ...cellLines.map(lines => lines.length * 10 + 10));
        ensure(rowH + 2);
        current.commands.push(rectCommand(MARGIN_X, y - rowH, CONTENT_W, rowH, rowIndex === 0 ? "0.945 0.953 0.965" : "1 1 1", BORDER));
        for (let col = 0; col < columns; col += 1) {
          if (col > 0) current.commands.push(`q ${BORDER} RG 0.6 w ${(MARGIN_X + col * cellW).toFixed(1)} ${(y - rowH).toFixed(1)} m ${(MARGIN_X + col * cellW).toFixed(1)} ${y.toFixed(1)} l S Q`);
          cellLines[col].forEach((line, lineIndex) => current.commands.push(textCommand(line, MARGIN_X + col * cellW + 6, y - 14 - lineIndex * 10, 7.6, rowIndex === 0 ? "F2" : "F1", TEXT)));
        }
        y -= rowH;
      }
      y -= 5;
      continue;
    }
    drawWrapped(block.text, { size: 9, color: TEXT, lineHeight: 13.2, gapBefore: 3 });
  }

  newPage();
  sectionTitle("SIGNATURES ÉLECTRONIQUES", 14);
  drawWrapped("Le document ci-dessous reprend les mêmes éléments de preuve que l’espace de signature : identité du signataire, horodatage et empreintes SHA-256.", { size: 8.5, color: MUTED, lineHeight: 12.5 });
  y -= 10;

  const signed = signatures.filter(item => item.signedAt || item.signatureName);
  const toRender = signed.length ? signed : content.signatories.map(item => ({ signerName: item.name, signerEmail: item.email, signerRole: item.role, signerOrganization: item.organization } as SD05PdfSignature));
  for (const signature of toRender) {
    const cardH = 150;
    ensure(cardH + 12);
    current.commands.push(rectCommand(MARGIN_X, y - cardH, CONTENT_W, cardH, "1 1 1", BORDER));
    current.commands.push(rectCommand(MARGIN_X, y - 28, 5, 28, PURPLE));
    current.commands.push(textCommand(signature.signerOrganization || "Organisation", MARGIN_X + 16, y - 17, 10.2, "F2", TEXT));
    current.commands.push(textCommand(signature.signerRole || "Signataire", PAGE_W - MARGIN_X - 12, y - 17, 7.5, "F1", MUTED, "right"));
    current.commands.push(textCommand(signature.signatureName || signature.signerName || "Signature", MARGIN_X + 20, y - 66, 18, "F3", "0.10 0.10 0.12"));
    current.commands.push(textCommand(signature.signatureMode === "drawn" ? "Signature manuscrite enregistrée" : "Signature électronique écrite", MARGIN_X + 20, y - 84, 7.5, "F1", MUTED));
    current.commands.push(textCommand(`Signé le : ${dateLabel(signature.signedAt)}`, MARGIN_X + 20, y - 106, 7.7, "F2", TEXT));
    current.commands.push(textCommand(`Email : ${signature.signerEmail || "-"}`, MARGIN_X + 20, y - 120, 7.7, "F1", TEXT));
    if (signature.contractHash) current.commands.push(textCommand(`SHA-256 document : ${signature.contractHash.slice(0, 44)}…`, MARGIN_X + 20, y - 136, 6.5, "F1", MUTED));
    y -= cardH + 12;
  }

  const totalPages = pages.length;
  const allInitials = signatures.flatMap(item => Object.values(item.initials || {})).map(value => String(value).trim()).filter(Boolean);
  const uniqueInitials = [...new Set(allInitials)].slice(0, 3);
  pages.forEach((page, index) => {
    page.commands.push(`q ${BORDER} RG 0.7 w ${MARGIN_X} 59 m ${PAGE_W - MARGIN_X} 59 l S Q`);
    page.commands.push(textCommand("GANDO", PAGE_W / 2, 42, 8.5, "F2", PURPLE, "center"));
    if (content.footerConfidentialityText) {
      const footer = wrap(content.footerConfidentialityText, 370, 5.3).slice(0, 2);
      footer.forEach((line, lineIndex) => page.commands.push(textCommand(line, PAGE_W / 2, 30 - lineIndex * 7, 5.3, "F1", "0.62 0.65 0.70", "center")));
    }
    page.commands.push(textCommand(`Page ${index + 1} / ${totalPages}`, PAGE_W / 2, 12, 5.5, "F2", "0.72 0.74 0.78", "center"));
    if (uniqueInitials.length) {
      const label = uniqueInitials.join(" · ");
      page.commands.push(rectCommand(PAGE_W - MARGIN_X - 74, 31, 74, 20, "1 1 1", "0.82 0.78 1"));
      page.commands.push(textCommand(label, PAGE_W - MARGIN_X - 37, 38, 9, "F3", PURPLE_DARK, "center"));
    } else if (content.requireInitialsEachPage) {
      page.commands.push(rectCommand(PAGE_W - MARGIN_X - 60, 32, 60, 18, undefined, "0.78 0.80 0.84", 0.7));
      page.commands.push(textCommand("PARAPHE", PAGE_W - MARGIN_X - 30, 38, 5.6, "F2", "0.62 0.65 0.70", "center"));
    }
  });

  const pageIds = pages.map((_, index) => 6 + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects.set(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = page.commands.join("\n");
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

  const maxId = Math.max(...objects.keys());
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects.get(id) || "<<>>"}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
