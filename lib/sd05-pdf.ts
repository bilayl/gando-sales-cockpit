import type { SD05Content } from "./sd-stage-content";

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


function rentalDate(value?: string | null) {
  if (!value) return "À compléter";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d).replace(/\//g, " / ");
}

function rentalLongDate(value?: string | null) {
  if (!value) return "À compléter";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function rentalRate(value: string | undefined, fallback: number) {
  const parsed = Number(String(value || "").replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rentalRateLabel(value: string | undefined, fallback: number) {
  return rentalRate(value, fallback).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function rentalMoney(value: number) {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " € HT";
}

function personalizeRentalText(value: string, content: SD05Content, companyName: string) {
  const rental = content.rentalTemplate;
  const company = rental.legalName || companyName || "Le Loueur";
  const gando = rentalRateLabel(rental.gandoRate, 2.7);
  const partner = rentalRateLabel(rental.partnerRate, 0.7);
  const total = rentalRateLabel(rental.totalRate, rentalRate(rental.gandoRate, 2.7) + rentalRate(rental.partnerRate, 0.7));
  let result = String(value || "");
  result = result.replace(/LR LOCATION/gi, company);
  result = result.replace(/LR Location/g, company);
  result = result.replace(/3,4\s*%/g, total + " %").replace(/3\.4\s*%/g, total + " %");
  result = result.replace(/2,7\s*%/g, gando + " %").replace(/2\.7\s*%/g, gando + " %");
  result = result.replace(/0,7\s*%/g, partner + " %").replace(/0\.7\s*%/g, partner + " %");
  if (rental.activityRegion) result = result.replace(/Guadeloupe/g, rental.activityRegion);
  return result;
}

function serializeRentalPdf(pages: Page[]) {
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

function rentalPageChrome(page: Page, content: SD05Content, pageNumber: number, totalPages: number) {
  const violet = "0.44 0.35 0.93";
  page.commands.push(rectCommand(0, PAGE_H - 31, PAGE_W, 31, violet));
  page.commands.push(circleCommands(PAGE_W / 2, PAGE_H - 31, 17.5, "1 1 1", violet));
  page.commands.push(circleCommands(PAGE_W / 2, PAGE_H - 31, 13.2, violet));
  page.commands.push(textCommand("G", PAGE_W / 2, PAGE_H - 36.5, 13.2, "F2", "1 1 1", "center"));
  page.commands.push(textCommand("G gando", PAGE_W / 2, 51, 10.5, "F2", "0.10 0.10 0.11", "center"));
  const footer = content.footerConfidentialityText || "CONFIDENTIALITÉ - Ce document est confidentiel. Toute publication, utilisation ou diffusion, même partielle, doit être autorisée préalablement.";
  const footerLines = wrap(footer, 510, 5.1).slice(0, 3);
  footerLines.forEach((line, index) => page.commands.push(textCommand(line, PAGE_W / 2, 34 - index * 6.2, 5.1, "F1", "0.31 0.31 0.33", "center")));
  if (pageNumber >= 9) page.commands.push(textCommand(String(pageNumber), PAGE_W - 38, 35, 7.2, "F1", "0.20 0.20 0.20", "right"));
}

function rentalTextLines(page: Page, source: string, content: SD05Content, companyName: string, mode: "columns" | "full" = "columns") {
  const violet = "0.37 0.20 0.74";
  const navy = "0.03 0.12 0.20";
  const body = personalizeRentalText(source, content, companyName);
  const rawLines = body.split(/\n/).map(line => line.trim()).filter(Boolean);
  const cols = mode === "columns"
    ? [{ x: 36, width: 238 }, { x: 321, width: 238 }]
    : [{ x: 36, width: 523 }];
  let col = 0;
  let y = 768;
  let bullet = false;

  const moveColumn = () => {
    if (col + 1 < cols.length) { col += 1; y = 768; return true; }
    return false;
  };

  for (let raw of rawLines) {
    if (raw === "–" || raw === "·" || raw === "•") { bullet = true; continue; }
    const article = /^(ARTICLE\s+\d+|PRÉAMBULE|ANNEXE\s+\d+)/i.test(raw);
    const subsection = /^\d+\.\d+\s+/.test(raw);
    const miniHeading = mode === "full" && /^(Exemple de stop-loss|Exemples de calcul|CALCUL|DONNÉE|TAUX|SITUATION|CONSÉQUENCE|Paramètre|Condition)$/i.test(raw);
    const definition = /^«[^»]+»/.test(raw);
    const numericHeading = mode === "full" && /^\d+\s+[A-ZÀÂÉÈÊÎÔÙÛÇ]/.test(raw);
    const font: Font = article || subsection || definition || miniHeading || numericHeading ? "F2" : "F1";
    const size = article ? 10.8 : subsection ? 9.1 : miniHeading || numericHeading ? 9 : definition ? 8.8 : 8.35;
    const color = article ? violet : navy;
    const lineHeight = article ? 13.2 : subsection ? 11.8 : 10.25;
    const gap = article ? 7 : subsection ? 4 : miniHeading ? 4 : 0;
    const prefix = bullet ? "•  " : "";
    bullet = false;
    const lines = wrap(prefix + raw, cols[col].width, size);

    const needed = gap + lines.length * lineHeight;
    if (y - needed < 76 && moveColumn()) {
      // continue in next column
    }
    y -= gap;
    for (const line of lines) {
      if (y < 76 && !moveColumn()) break;
      page.commands.push(textCommand(line, cols[col].x, y, size, font, color));
      y -= lineHeight;
    }
  }
}

function rentalTableRow(page: Page, y: number, heights: number, cells: Array<{ x: number; w: number; text: string; bold?: boolean }>, fill?: string) {
  if (fill) page.commands.push(rectCommand(36, y - heights, 523, heights, fill));
  for (const cell of cells) {
    const lines = wrap(cell.text, cell.w - 10, 8.2).slice(0, 4);
    lines.forEach((line, index) => page.commands.push(textCommand(line, cell.x + 5, y - 13 - index * 10.3, 8.2, cell.bold ? "F2" : "F1", fill ? "1 1 1" : "0.06 0.07 0.09")));
  }
}

function renderRentalAnnex10(page: Page, content: SD05Content, companyName: string) {
  const rental = content.rentalTemplate;
  const company = rental.legalName || companyName;
  const g = rentalRate(rental.gandoRate, 2.7);
  const p = rentalRate(rental.partnerRate, 0.7);
  const total = rentalRate(rental.totalRate, g + p);
  const gl = rentalRateLabel(rental.gandoRate, 2.7);
  const pl = rentalRateLabel(rental.partnerRate, 0.7);
  const tl = rentalRateLabel(rental.totalRate, total);
  const dark = "0.18 0.16 0.35";
  const navy = "0.03 0.12 0.20";
  page.commands.push(textCommand("ANNEXE 1 : CONDITIONS FINANCIÈRES ET COMMERCIALES", 36, 760, 11.5, "F2", navy));
  rentalTableRow(page, 746, 22, [{ x:36,w:235,text:"Paramètre",bold:true },{x:271,w:288,text:"Condition",bold:true}], dark);
  let y=716;
  const rows:Array<[string,string,number]> = [
    ["Tarification client totale", `${tl} % HT du montant de chaque Caution activée (${gl} % HT Gando + ${pl} % HT ${company})`, 35],
    ["Part Gando", `${gl} % HT du montant de chaque Caution activée`, 28],
    [`Marge ${company}`, `${pl} % HT du montant de chaque Caution activée ;\nExemples : ${rentalMoney(950*p/100)} sur 950 € et ${rentalMoney(1500*p/100)} sur 1 500 €.\nLa marge s'applique à toutes les Cautions activées, sans seuil minimal ni palier.`, 58],
    ["Comptabilisation et règlement", "Inscription automatique à chaque activation ; arrêté trimestriel et paiement après facture", 36],
    ["Plafond de Caution", "2 500 € par Caution Éligible", 25],
    ["Durée", "Soixante (60) jours maximum", 25],
    ["Frais d'Encaissement", "3,5 % du montant encaissé + 2 € HT", 25],
    ["Garantie d'encaissement", "Uniquement si les conditions d'éligibilité respectées", 25],
  ];
  for(const [left,right,h] of rows){
    rentalTableRow(page,y,h,[{x:36,w:235,text:left,bold:true},{x:271,w:288,text:right}]);
    y-=h;
  }
  y-=18;
  page.commands.push(textCommand("Exemples de calcul",36,y,10.5,"F2","0.04 0.04 0.06")); y-=12;
  rentalTableRow(page,y,22,[{x:36,w:165,text:"MONTANT DE LA CAUTION",bold:true},{x:201,w:165,text:`PART GANDO (${gl} % HT)`,bold:true},{x:366,w:193,text:`MARGE ${company.toUpperCase()} (${pl} % HT)`,bold:true}],dark); y-=27;
  for(const amount of [500,1000,1500,2000,2500]){
    rentalTableRow(page,y,22,[{x:36,w:165,text:amount.toLocaleString("fr-FR")+" €",bold:true},{x:201,w:165,text:rentalMoney(amount*g/100)},{x:366,w:193,text:rentalMoney(amount*p/100)}]);
    y-=22;
  }
  y-=7;
  const note=`Le total HT facturé au Client Final correspond à la somme de la part Gando et de la marge ${company}, soit ${tl} % HT. Le total TTC dépend du régime fiscal applicable. La marge n'est acquise qu'après encaissement définitif des Frais de Sécurisation et sous réserve de l'Article 9.3.`;
  wrap(note,523,7.2).slice(0,3).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*9,7.2,"F3","0.22 0.22 0.24")));
  y-=39;
  page.commands.push(textCommand("ANNEXE 2 : MÉCANISME DE STOP-LOSS",36,y,11.5,"F2",navy)); y-=17;
  const calc="CALCUL  Taux de Sinistralité = (Garanties versées - sommes recouvrées - majorations de stop-loss encaissées) ÷ volume des Cautions activées × 100.";
  wrap(calc,523,8.2).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*10.5,8.2,i===0?"F2":"F1","0.05 0.05 0.07")));
  y-=30;
  rentalTableRow(page,y,22,[{x:36,w:165,text:"TAUX",bold:true},{x:201,w:165,text:"SITUATION",bold:true},{x:366,w:193,text:"CONSÉQUENCE",bold:true}],dark); y-=30;
  rentalTableRow(page,y,42,[{x:36,w:165,text:"≤ 4 %",bold:true},{x:201,w:165,text:"Situation normale"},{x:366,w:193,text:"Aucune majoration. Les frais standards restent applicables."}]); y-=50;
  rentalTableRow(page,y,54,[{x:36,w:165,text:"> 4 % et < 6 %",bold:true},{x:201,w:165,text:"Dépassement"},{x:366,w:193,text:"Après notification écrite, Gando peut appliquer une majoration temporaire allant jusqu'à 10 % HT sur chaque"}]);
}

function renderRentalAnnex11(page: Page, content: SD05Content, companyName: string) {
  const dark = "0.18 0.16 0.35";
  const navy = "0.03 0.12 0.20";
  let y=770;
  rentalTableRow(page,y,22,[{x:366,w:193,text:"nouvelle Caution."}]); y-=38;
  rentalTableRow(page,y,48,[{x:36,w:165,text:"≥ 6 %",bold:true},{x:201,w:165,text:"Risque élevé"},{x:366,w:193,text:"Gando peut appliquer la majoration et suspendre l’octroi de nouvelles Garanties."}]); y-=58;
  rentalTableRow(page,y,45,[{x:36,w:165,text:"Retour à ≤ 4 %",bold:true},{x:201,w:165,text:"Retour à l’équilibre"},{x:366,w:193,text:"La majoration revient à 0 % à compter du mois suivant."}]); y-=70;
  page.commands.push(textCommand("Exemple de stop-loss",36,y,10.5,"F2","0.04 0.04 0.06")); y-=15;
  const italic="La majoration n’est jamais rétroactive. Elle ne concerne que les nouvelles cautions activées après notification, est recalculée chaque mois et ne remet pas en cause les cautions déjà activées. Elle s’ajoute aux frais standards.";
  wrap(italic,523,7.8).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*10,7.8,"F3","0.12 0.15 0.22"))); y-=35;
  rentalTableRow(page,y,22,[{x:36,w:330,text:"DONNÉE",bold:true},{x:366,w:193,text:"MONTANT OU CALCUL",bold:true}],dark); y-=28;
  const exRows=[["Volume de cautions activées","100 000 €"],["Seuil standard à 4 %","4 000 €"],["Garanties nettes supportées par Gando","5 000 €"],["Taux constaté","5 % (dépassement de 1 000 €)"]];
  for(const [l,r] of exRows){ rentalTableRow(page,y,28,[{x:36,w:330,text:l,bold:true},{x:366,w:193,text:r}]); y-=28; }
  y-=4;
  page.commands.push(rectCommand(36,y-23,523,23,"0.96 0.96 0.99"));
  wrap("Le taux atteint 5 % : Gando peut donc appliquer une majoration aux nouvelles cautions. La majoration cesse lorsque le taux revient à 4 % ou moins, notamment grâce aux recouvrements, aux nouvelles cautions activées ou aux majorations encaissées.",513,7.5).slice(0,2).forEach((line,i)=>page.commands.push(textCommand(line,41,y-10-i*9,7.5,"F1","0.10 0.13 0.20")));
  y-=42;
  page.commands.push(textCommand("ANNEXE 3 : DOSSIER D’ENCAISSEMENT",36,y,11.5,"F2",navy)); y-=17;
  page.commands.push(textCommand("Pour chaque Demande d'Encaissement, le Loueur utilisateur remet au minimum :",36,y,8.4,"F1","0.04 0.04 0.06")); y-=14;
  const items=[
    "le Contrat de location signé ou accepté, la version horodatée des CGL applicable et la preuve de leur présentation et acceptation ;",
    "la preuve du prix, du montant de la Caution et des informations présentées avant la location ;",
    "les états des lieux de départ et de retour, datés, avec photographies exploitables ;",
    "le justificatif de la remise et de la restitution du véhicule ;",
    "le décompte détaillé de la créance et, selon le cas, un devis ou une facture détaillé établi par un professionnel identifié aux prix du marché, un procès-verbal, une déclaration ou un justificatif de franchise ;",
    "les échanges avec le Client Final et la preuve de sa mise en mesure de présenter ses observations ;",
    "tout constat, rapport, dépôt de plainte ou déclaration à l'assureur pertinent ;",
    "une attestation d'absence d'indemnisation ou de double recouvrement, sur demande.",
    "une copie d'une pièce d'identité officielle du Client Final, impérative pour toute Caution d'un montant supérieur ou égal à 100 euros ;",
  ];
  items.forEach((item,index)=>{
    const lines=wrap(`${index+1}.   ${item}`,510,7.15);
    lines.forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*8.6,7.15,"F1","0.06 0.07 0.09")));
    y-=lines.length*8.6;
  });
  y-=4;
  const keep="Le Loueur utilisateur conserve les originaux de ces pièces pendant au moins douze (12) mois à compter de la clôture de la Caution et les tient à disposition de Gando. Une Demande d'Encaissement incomplète ou non complétée dans les sept (7) jours ouvrés peut être rejetée.";
  wrap(keep,523,6.8).slice(0,3).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*8,6.8,"F3","0.22 0.22 0.24"))); y-=31;
  page.commands.push(textCommand("ANNEXE 4 : CLAUSE À INTÉGRER AUX CONDITIONS GÉNÉRALES DE LOCATION",36,y,10.6,"F2",navy)); y-=15;
  const source=personalizeRentalText("Le texte ci-dessous constitue une clause modèle à intégrer aux CGL du Loueur utilisateur ou à remplacer par une clause d'effet juridique équivalent. Les champs entre crochets doivent être complétés et le texte adapté au parcours effectivement proposé au Client Final.",content,companyName);
  wrap(source,523,6.9).slice(0,3).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*8.2,6.9,"F3","0.22 0.22 0.24"))); y-=31;
  page.commands.push(textCommand("1 Dépôt de garantie et recours au service Gando",36,y,9.1,"F2","0.04 0.04 0.06")); y-=13;
  const p1="Afin de garantir l'exécution de ses obligations au titre du Contrat de location, le Client Final reste tenu envers le Loueur utilisateur à hauteur du dépôt de garantie indiqué dans les conditions particulières, soit [MONTANT] euros, pendant une durée de [DURÉE]. Sous réserve de son éligibilité et de son acceptation des conditions applicables, le Client Final peut utiliser le service Gando, qui permet de ne pas immobiliser initialement l'intégralité de ce montant.";
  wrap(p1,523,7.2).slice(0,5).forEach((line,i)=>page.commands.push(textCommand(line,36,y-i*8.7,7.2,"F1","0.06 0.07 0.09")));
}

function buildExactRentalSD05Pdf(input: { content: SD05Content; companyName: string; signatures?: SD05PdfSignature[] }) {
  const { content, companyName } = input;
  const pages: Page[] = Array.from({ length: 12 }, () => ({ commands: [] }));
  const violet = "0.44 0.35 0.93";
  const dark = "0.03 0.12 0.20";
  const rental = content.rentalTemplate;
  const company = rental.legalName || companyName || "Le Loueur";
  const gandoRate = rentalRate(rental.gandoRate, 2.7);
  const partnerRate = rentalRate(rental.partnerRate, 0.7);
  const totalRate = rentalRate(rental.totalRate, gandoRate + partnerRate);
  const gl = rentalRateLabel(rental.gandoRate, gandoRate);
  const pl = rentalRateLabel(rental.partnerRate, partnerRate);
  const tl = rentalRateLabel(rental.totalRate, totalRate);

  pages.forEach((page,index)=>rentalPageChrome(page,content,index+1,12));

  const p1=pages[0];
  p1.commands.push(textCommand("GANDO SOLUTIONS",42,778,22,"F2","0 0 0"));
  p1.commands.push(textCommand("Contrat",388,783,16.5,"F2","0 0 0"));
  p1.commands.push(textCommand(content.contractReference || "SD05-À-COMPLÉTER",559,783,16.5,"F2",violet,"right"));
  p1.commands.push(textCommand(`Date d’émission : ${rentalDate(content.effectiveDate)}`,559,760,8.5,"F2","0 0 0","right"));
  p1.commands.push(textCommand(`Date de validité : ${rentalDate(content.signatureDeadline)}`,559,748,8.5,"F2","0 0 0","right"));

  p1.commands.push(textCommand("L’établissement",42,710,11.2,"F2","0.37 0.20 0.74"));
  p1.commands.push(textCommand("GANDO SOLUTIONS",42,687,8.7,"F1","0 0 0"));
  p1.commands.push(textCommand("SAS au capital de 1 000,00 euros",42,675,8.2,"F1","0 0 0"));
  p1.commands.push(textCommand("RCS Meaux, N°943 391 201",42,663,8.2,"F1","0 0 0"));
  p1.commands.push(textCommand("3 chemin de la porte verte, 77144 Montévrain",42,651,8.2,"F1","0 0 0"));
  p1.commands.push(textCommand("Coordonnées : contact@gando.app",42,639,8.2,"F1","0 0.35 0.75"));

  p1.commands.push(textCommand("Le Loueur Utilisateur",559,710,11.2,"F2","0.37 0.20 0.74","right"));
  const rightX=559;
  const legalLines=[
    `Nom de l’entreprise : ${company.toUpperCase()}`,
    [rental.legalForm, rental.shareCapital ? `au capital de ${rental.shareCapital}` : ""].filter(Boolean).join(" "),
    rental.siren ? `N° SIREN : ${rental.siren}` : "N° SIREN : À compléter",
    rental.vatNumber ? `Numéro de TVA : ${rental.vatNumber}` : "Numéro de TVA : À compléter",
  ].filter(Boolean);
  let ry=687;
  legalLines.forEach(line=>{p1.commands.push(textCommand(line,rightX,ry,8.2,"F1","0 0 0","right")); ry-=12;});
  const addr=wrap(`Adresse du siège social : ${rental.registeredOffice || "À compléter"}`,265,8.2).slice(0,2);
  addr.forEach(line=>{p1.commands.push(textCommand(line,rightX,ry,8.2,"F1","0 0 0","right")); ry-=11;});
  if(rental.contactEmail) p1.commands.push(textCommand(rental.contactEmail,rightX,ry,8.2,"F1","0 0 0","right"));

  p1.commands.push(textCommand("Service(s) de l’offre de sécurisation de caution en ligne Gando",36,595,11,"F2",dark));
  p1.commands.push(rectCommand(36,412,523,166,"0.965 0.960 0.990",violet,0.7));
  p1.commands.push(textCommand("STRUCTURE TARIFAIRE",42,559,10.2,"F2",violet));
  const tLines=[
    `Frais de sécurisation Gando : Fixés à ${gl} % HT du montant de la caution Gando activée.`,
    `Tarification totale client : ${tl} % HT du montant de chaque Caution activée (${gl} % HT Gando + ${pl} % HT ${company}).`,
    `Marge ${company} : ${pl} % HT du montant de chaque Caution activée, sans seuil ni palier.`,
  ];
  let ty=530;
  tLines.forEach((line,index)=>{
    const lines=wrap(line,502,9.7);
    lines.forEach((l,i)=>p1.commands.push(textCommand(l,42,ty-i*12,9.7,index===0?"F1":"F1","0.03 0.03 0.04")));
    ty-=lines.length*12+10;
  });
  p1.commands.push(textCommand(`Exemples de marge ${company} :`,42,ty,9.7,"F1","0.03 0.03 0.04")); ty-=14;
  p1.commands.push(textCommand(`•     ${rentalMoney(950*partnerRate/100)} pour une Caution de 950 € ;`,58,ty,9.5,"F2","0.03 0.03 0.04")); ty-=13;
  p1.commands.push(textCommand(`•     ${rentalMoney(1500*partnerRate/100)} pour une Caution de 1 500 €.`,58,ty,9.5,"F2","0.03 0.03 0.04"));

  p1.commands.push(textCommand("Entrée en vigueur",36,378,11.2,"F2",dark));
  p1.commands.push(textCommand(`Date de mise en production : ${rentalLongDate(content.goLiveDate || content.effectiveDate)}`,36,353,9.5,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand(`Durée initiale : ${content.term || "12 mois à compter de la date de mise en production"}`,36,337,9.5,"F1","0.03 0.03 0.04"));

  const clientSigner=content.signatories.find(item=>item.organization!=="GANDO SOLUTIONS") || content.signatories[0];
  const gandoSigner=content.signatories.find(item=>item.organization==="GANDO SOLUTIONS") || content.signatories[1];
  p1.commands.push(textCommand("Pour le loueur utilisateur",42,242,8.1,"F2",violet));
  p1.commands.push(textCommand(`Nom  ${clientSigner?.name || ""}`,42,220,9.2,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand(`Fonction  ${clientSigner?.role || ""}`,42,196,9.2,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand("Le",42,172,9.2,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand("Pour Gando Solutions",286,242,8.1,"F2",violet));
  p1.commands.push(textCommand(`Nom  ${gandoSigner?.name || "Bilayl MATOU"}`,286,220,9.2,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand(`Fonction  ${gandoSigner?.role || "Président"}`,286,196,9.2,"F1","0.03 0.03 0.04"));
  p1.commands.push(textCommand("Le",286,172,9.2,"F1","0.03 0.03 0.04"));

  const bodyPages=(content.contractSummary || RENTAL_TEMPLATE_BODY).split(/\s*\[\[PAGE_BREAK\]\]\s*/).filter(Boolean);
  for(let i=0;i<8;i++) rentalTextLines(pages[i+1],bodyPages[i] || "",content,companyName,"columns");
  renderRentalAnnex10(pages[9],content,companyName);
  renderRentalAnnex11(pages[10],content,companyName);
  rentalTextLines(pages[11],bodyPages[10] || "",content,companyName,"full");

  return serializeRentalPdf(pages);
}

export function buildBrandedSD05Pdf(input: { content: SD05Content; companyName: string; signatures?: SD05PdfSignature[] }) {
  const { content, companyName } = input;
  const signatures = input.signatures || [];
  const pages: Page[] = [];
  const legal = content.contractTemplate === "legal_convention";
  const band = legal ? "0.196 0.196 0.196" : PURPLE;
  let current: Page = { commands: [] };
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
