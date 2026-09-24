import type { SD05Content } from "@/lib/sd-stage-content";

const PAGE_BREAK_HTML = '<div data-page-break="true"></div>';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headingTag(line: string) {
  if (/^(PRÉAMBULE|PREAMBULE)$/i.test(line)) return "h1";
  if (/^(ARTICLE\s+\d+|ANNEXE\s+\d+)/i.test(line)) return "h2";
  if (/^\d+\.\d+\.?\s+/i.test(line)) return "h3";
  return null;
}

export function contractTextToHtml(value: string) {
  const source = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!source) return "<p><br></p>";

  const pages = source.split(/\s*\[\[PAGE_BREAK\]\]\s*/);
  return pages.map(page => {
    const lines = page.split("\n");
    const html: string[] = [];
    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${paragraph.map(escapeHtml).join("<br>")}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list.length) return;
      html.push(`<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      list = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }
      const heading = headingTag(line);
      if (heading) {
        flushParagraph();
        flushList();
        html.push(`<${heading}>${escapeHtml(line)}</${heading}>`);
        continue;
      }
      if (/^(?:[-–•]|\*)\s+/.test(line)) {
        flushParagraph();
        list.push(line.replace(/^(?:[-–•]|\*)\s+/, ""));
        continue;
      }
      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html.join("");
  }).join(PAGE_BREAK_HTML);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

export function sanitizeContractHtml(value: string) {
  return String(value || "")
    .slice(0, 120_000)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|iframe|object|embed|link|meta|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|iframe|object|embed|link|meta|form|input|button)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

export function contractHtmlToText(value: string) {
  let html = sanitizeContractHtml(value);
  html = html.replace(/<div\b[^>]*data-page-break\s*=\s*["']?true["']?[^>]*>\s*<\/div>/gi, "\n\n[[PAGE_BREAK]]\n\n");
  html = html.replace(/<br\s*\/?\s*>/gi, "\n");
  html = html.replace(/<li\b[^>]*>/gi, "- ");
  html = html.replace(/<\/(p|div|h1|h2|h3|h4|li|ul|ol|blockquote|tr|table)>/gi, "\n\n");
  html = html.replace(/<\/(td|th)>/gi, " | ");
  html = html.replace(/<[^>]+>/g, "");
  html = decodeEntities(html)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return html.slice(0, 60_000);
}

function rate(value: string, fallback: string) {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function dateLabel(value: string) {
  if (!value) return "À compléter";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function longDate(value: string) {
  if (!value) return "À compléter";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function rentalCoverHtml(content: SD05Content, companyName: string) {
  const rental = content.rentalTemplate;
  const company = escapeHtml(rental.legalName || companyName || "Le Loueur");
  const gandoRate = escapeHtml(rate(rental.gandoRate, "2,70"));
  const partnerRate = escapeHtml(rate(rental.partnerRate, "0,70"));
  const totalRate = escapeHtml(rate(rental.totalRate, "3,40"));
  const clientSigner = content.signatories.find(item => item.organization !== "GANDO SOLUTIONS") || content.signatories[0];
  const gandoSigner = content.signatories.find(item => item.organization === "GANDO SOLUTIONS") || content.signatories[1];

  return `
  <section class="contract-cover">
    <div class="brand-band"><div class="gando-round">G</div></div>
    <div class="cover-head">
      <div class="gando-title">GANDO SOLUTIONS</div>
      <div class="contract-meta">
        <div class="contract-name">Contrat <strong>${escapeHtml(content.contractReference || "SD05-À-COMPLÉTER")}</strong></div>
        <div>Date d’émission : <strong>${escapeHtml(dateLabel(content.effectiveDate))}</strong></div>
        <div>Date de validité : <strong>${escapeHtml(dateLabel(content.signatureDeadline))}</strong></div>
      </div>
    </div>
    <div class="party-grid">
      <div>
        <h3>L’établissement</h3>
        <p>GANDO SOLUTIONS<br>SAS au capital de 1 000,00 euros<br>RCS Meaux, N°943 391 201<br>3 chemin de la porte verte, 77144 Montévrain<br>Coordonnées : <u>contact@gando.app</u></p>
      </div>
      <div class="party-right">
        <h3>Le Loueur Utilisateur</h3>
        <p>Nom de l’entreprise : <strong>${company.toUpperCase()}</strong><br>
        ${escapeHtml(rental.legalForm || "SAS")}${rental.shareCapital ? ` au capital de ${escapeHtml(rental.shareCapital)}` : ""}<br>
        N° SIREN : ${escapeHtml(rental.siren || "À compléter")}<br>
        Numéro de TVA : ${escapeHtml(rental.vatNumber || "À compléter")}<br>
        Adresse du siège social : ${escapeHtml(rental.registeredOffice || "À compléter")}</p>
      </div>
    </div>
    <h2 class="service-title">Service(s) de l’offre de sécurisation de caution en ligne Gando</h2>
    <div class="pricing-box">
      <h3>STRUCTURE TARIFAIRE</h3>
      <p>Frais de sécurisation Gando : <strong>Fixés à ${gandoRate} % HT du montant de la caution Gando activée.</strong></p>
      <p>Tarification totale client : <strong>${totalRate} % HT du montant de chaque Caution activée (${gandoRate} % HT Gando + ${partnerRate} % HT ${company}).</strong></p>
      <p>Marge ${company} : <strong>${partnerRate} % HT du montant de chaque Caution activée, sans seuil ni palier.</strong></p>
    </div>
    <h2 class="service-title">Entrée en vigueur</h2>
    <p>Date de mise en production : ${escapeHtml(longDate(content.goLiveDate || content.effectiveDate))}<br>
    Durée initiale : ${escapeHtml(content.term || "12 mois à compter de la date de mise en production")}</p>
    <div class="signature-grid">
      <div><span>Pour le loueur utilisateur</span><p>Nom&nbsp;&nbsp; ${escapeHtml(clientSigner?.name || "")}</p><p>Fonction&nbsp;&nbsp; ${escapeHtml(clientSigner?.role || "")}</p><p>Le</p></div>
      <div><span>Pour Gando Solutions</span><p>Nom&nbsp;&nbsp; ${escapeHtml(gandoSigner?.name || "Bilayl MATOU")}</p><p>Fonction&nbsp;&nbsp; ${escapeHtml(gandoSigner?.role || "Président")}</p><p>Le</p></div>
    </div>
    <div class="cover-footer"><strong>Gando</strong><br><small>CONFIDENTIALITÉ — ${escapeHtml(content.footerConfidentialityText || "Document confidentiel.")}</small></div>
  </section>`;
}

export function contractPrintHtml(input: { content: SD05Content; companyName: string }) {
  const { content, companyName } = input;
  const body = sanitizeContractHtml(content.contractHtml || contractTextToHtml(content.contractSummary));
  const cover = content.contractTemplate === "rental_exact" ? rentalCoverHtml(content, companyName) : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin:0; background:#fff; color:#111827; font-family: Arial, Helvetica, sans-serif; font-size:10pt; line-height:1.45; }
.contract-cover, .contract-page { width:210mm; min-height:297mm; padding:18mm 18mm 16mm; position:relative; page-break-after:always; background:#fff; }
.contract-cover { padding-top:18mm; }
.brand-band { position:absolute; left:0; right:0; top:0; height:12mm; background:#b6adf6; }
.gando-round { position:absolute; left:50%; top:7.5mm; transform:translateX(-50%); width:11mm; height:11mm; border-radius:50%; border:1.2mm solid #fff; background:#b6adf6; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16pt; }
.cover-head { display:grid; grid-template-columns:1fr 1fr; gap:12mm; margin-top:2mm; align-items:start; }
.gando-title { font-size:22pt; font-weight:800; letter-spacing:-.4pt; }
.contract-meta { text-align:right; font-size:9.5pt; }
.contract-name { font-size:16pt; margin-bottom:3mm; }
.contract-name strong, .party-grid h3, .pricing-box h3 { color:#6437cc; }
.party-grid { display:grid; grid-template-columns:1fr 1fr; gap:8mm; margin-top:9mm; }
.party-grid h3 { font-size:11pt; margin:0 0 4mm; }
.party-grid p { margin:0; font-size:8.8pt; line-height:1.35; }
.party-right { text-align:right; }
.service-title { color:#0d2c4a; font-size:11.5pt; margin:8mm 0 4mm; }
.pricing-box { border:1px solid #7864ff; background:#f8f7ff; padding:4mm 3mm; }
.pricing-box h3 { margin:0 0 5mm; font-size:10.5pt; }
.pricing-box p { margin:0 0 4mm; }
.signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:18mm; margin-top:16mm; }
.signature-grid span { color:#6437cc; font-weight:700; font-size:8pt; }
.signature-grid p { min-height:7mm; margin:2mm 0; }
.cover-footer { position:absolute; left:18mm; right:18mm; bottom:9mm; text-align:center; font-size:7pt; color:#64748b; }
.cover-footer strong { color:#111827; font-size:10pt; }
.contract-body { background:#f3f4f6; padding:10mm 0; }
.contract-page { margin:0 auto 10mm; box-shadow:0 2mm 8mm rgba(15,23,42,.08); overflow:hidden; }
.contract-page h1 { color:#0d2c4a; font-size:18pt; margin:0 0 8mm; }
.contract-page h2 { color:#6437cc; font-size:12pt; margin:7mm 0 3mm; }
.contract-page h3 { color:#0d2c4a; font-size:10.5pt; margin:5mm 0 2mm; }
.contract-page p { margin:0 0 4mm; }
.contract-page ul, .contract-page ol { padding-left:7mm; margin:0 0 4mm; }
.contract-page table { width:100%; border-collapse:collapse; margin:4mm 0; }
.contract-page th, .contract-page td { border:1px solid #cbd5e1; padding:2mm; vertical-align:top; }
.contract-page blockquote { border-left:3px solid #7864ff; padding-left:4mm; color:#475569; }
.page-break { page-break-before:always; }
[data-page-break="true"] { break-after:page; page-break-after:always; height:0; }
@media print { .contract-body { background:#fff; padding:0; } .contract-page { box-shadow:none; margin:0; } }
</style></head><body>${cover}<main class="contract-body"><section class="contract-page">${body.replace(/<div\b[^>]*data-page-break\s*=\s*["']?true["']?[^>]*>\s*<\/div>/gi, '</section><section class="contract-page">')}</section></main></body></html>`;
}
