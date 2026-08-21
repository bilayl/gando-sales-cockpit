import { apiError } from "@/lib/hubspot";
import { normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfLine = { text: string; bold?: boolean; size?: number; gap?: number };

function normalizePdfText(value: string) {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/€/g, "EUR").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}
function escapePdf(value: string) { return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(value: string, width: number) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean); const lines: string[] = []; let current = "";
  for (const word of words) { const next = current ? `${current} ${word}` : word; if (next.length > width && current) { lines.push(current); current = word; } else current = next; }
  if (current) lines.push(current); return lines.length ? lines : [""];
}
function headingKind(raw: string) {
  const value = raw.trim();
  if (/^(?:H2:\s*|##\s+|ARTICLE\s+\d+|ANNEXE\s+\d+|PRÉAMBULE|PREAMBULE|ENTRÉE EN VIGUEUR|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE)/i.test(value)) return 2;
  if (/^(?:H3:\s*|###\s+|\d+\.\d+\.?\s+)/i.test(value)) return 3;
  if (/^(?:H4:\s*|####\s+)/i.test(value)) return 4;
  return 0;
}
function cleanHeading(raw: string) { return raw.trim().replace(/^(?:H2:|H3:|H4:)\s*/i, "").replace(/^#{2,4}\s+/, "").trim(); }

function buildPdf(sourceLines: PdfLine[]) {
  const pages: PdfLine[][] = []; let page: PdfLine[] = []; let used = 0;
  for (const line of sourceLines) {
    const size = line.size || 9; const wrapped = wrap(line.text, size >= 13 ? 78 : size >= 11 ? 92 : 108);
    for (let index = 0; index < wrapped.length; index += 1) {
      const item = { ...line, text: wrapped[index], gap: index === 0 ? line.gap : 0 }; const height = (item.gap || 0) + Math.max(12, size + 4);
      if (page.length && used + height > 710) { pages.push(page); page = []; used = 0; }
      page.push(item); used += height;
    }
  }
  if (page.length) pages.push(page); if (!pages.length) pages.push([{ text: "Contrat Gando" }]);
  const pageIds = pages.map((_, i) => 5 + i * 2); const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((lines, pageIndex) => {
    const pageId = pageIds[pageIndex]; const contentId = pageId + 1; let y = 790; const commands: string[] = [];
    for (const line of lines) { y -= line.gap || 0; const size = line.size || 9; commands.push(`BT /${line.bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 48 ${y.toFixed(1)} Tm (${escapePdf(line.text)}) Tj ET`); y -= Math.max(12, size + 4); }
    commands.push(`BT /F1 7 Tf 1 0 0 1 48 28 Tm (GANDO SOLUTIONS - Document signe - Page ${pageIndex + 1} / ${pages.length}) Tj ET`);
    const stream = commands.join("\n");
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });
  const maxId = Math.max(...objects.keys()); let pdf = "%PDF-1.4\n%âãÏÓ\n"; const offsets = [0];
  for (let id = 1; id <= maxId; id += 1) { offsets[id] = Buffer.byteLength(pdf, "latin1"); pdf += `${id} 0 obj\n${objects.get(id) || "<<>>"}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, "latin1"); pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, "latin1");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess(); const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const document = bundle.documents.find(item => item.code === "SD05"); if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);
    if (content.contractStatus !== "signed" || document.status !== "validated") throw Object.assign(new Error("Le PDF est disponible uniquement lorsque le contrat est signé."), { status: 409 });
    const { data: signatures, error } = await getSupabaseAdmin().from("sd_contract_signature_requests").select("signer_name,signer_email,signer_role,signer_organization,signature_name,signature_mode,signed_at,contract_hash,signed_payload_hash").eq("document_id", document.id).eq("status", "signed").order("signed_at", { ascending: true });
    if (error) throw error;
    const lines: PdfLine[] = [
      { text: "GANDO SOLUTIONS", bold: true, size: 10 }, { text: content.contractTitle || "Contrat Gando", bold: true, size: 17, gap: 14 },
      { text: `${content.contractReference || "Sans référence"} - ${content.contractVersion || "Version non renseignée"}`, size: 9, gap: 4 },
      { text: `Partenaire / client : ${bundle.room.company_name}`, bold: true, size: 10, gap: 16 }, { text: `Mise en production : ${content.goLiveDate || content.effectiveDate || "À compléter"}` },
      { text: `Durée : ${content.term || "À compléter"}` }, { text: `Renouvellement : ${content.renewal || "À compléter"}` }, { text: `Préavis / résiliation : ${content.terminationNotice || "À compléter"}` },
    ];
    if (content.legalItems.length) { lines.push({ text: "CONDITIONS PARTICULIÈRES", bold: true, size: 12, gap: 18 }); for (const item of content.legalItems) lines.push({ text: `${item.topic} : ${item.notes || "À compléter"}`, gap: 3 }); }
    lines.push({ text: "CONTRAT", bold: true, size: 12, gap: 18 });
    for (const raw of content.contractSummary.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)) { const kind = headingKind(raw); lines.push({ text: cleanHeading(raw), bold: kind > 0, size: kind === 2 ? 11 : kind === 3 ? 10 : 9, gap: kind === 2 ? 12 : kind ? 6 : 4 }); }
    lines.push({ text: "SIGNATURES ÉLECTRONIQUES", bold: true, size: 12, gap: 20 });
    for (const signature of signatures || []) { lines.push({ text: `${signature.signer_organization || "Organisation"} - ${signature.signature_name || signature.signer_name} - ${signature.signer_role || ""}`, bold: true, size: 10, gap: 8 }, { text: `Signé le ${signature.signed_at ? new Date(signature.signed_at).toLocaleString("fr-FR") : "-"} - mode ${signature.signature_mode === "drawn" ? "manuscrit" : "écrit"}` }, { text: `Email : ${signature.signer_email}` }, { text: `Empreinte document SHA-256 : ${signature.contract_hash}` }, { text: `Empreinte preuve SHA-256 : ${signature.signed_payload_hash || "-"}` }); }
    if (content.footerConfidentialityText) lines.push({ text: content.footerConfidentialityText, size: 7, gap: 18 });
    const pdf = buildPdf(lines); const safe = String(content.contractReference || "SD05-signe").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${safe}.pdf"`, "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
