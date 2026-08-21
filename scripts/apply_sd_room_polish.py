from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Anchor not found in {path}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))

def regex_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Pattern matched {count} times in {path}: {pattern[:100]!r}")
    write(path, updated)

# SD05: smaller legal header/logo while preserving the standard first-page structure.
replace_once(
    "components/sd05-contract-renderer.tsx",
    '      <div className="relative h-[58px] shrink-0" style={{ backgroundColor: bandColor }}>\n        <GandoMark tone={legal ? "dark" : "purple"} className="absolute left-1/2 top-[13px] z-10 h-[66px] w-[66px] -translate-x-1/2 rounded-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.28)]" />\n      </div>\n      <div className={compact ? "flex flex-1 flex-col px-6 pb-5 pt-11 sm:px-8" : "flex flex-1 flex-col px-8 pb-6 pt-12 sm:px-12 lg:px-14"}>',
    '      <div className="relative h-[40px] shrink-0" style={{ backgroundColor: bandColor }}>\n        <GandoMark tone={legal ? "dark" : "purple"} className="absolute left-1/2 top-[7px] z-10 h-[46px] w-[46px] -translate-x-1/2 rounded-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.22)]" />\n      </div>\n      <div className={compact ? "flex flex-1 flex-col px-6 pb-5 pt-8 sm:px-8" : "flex flex-1 flex-col px-8 pb-6 pt-9 sm:px-12 lg:px-14"}>'
)

regex_once(
    "components/sd05-contract-renderer.tsx",
    r'function ContractBlock\(\{ block, articleColor \}: \{ block: ContractRenderBlock; articleColor: string \}\) \{.*?\n\}\n\nfunction ContractFooter',
    '''function ContractBlock({ block, articleColor }: { block: ContractRenderBlock; articleColor: string }) {
  if (block.kind === "major") {
    return <h2 className="pt-1 text-[17px] font-black uppercase tracking-[0.02em]" style={{ color: articleColor }}>{block.text}</h2>;
  }
  if (block.kind === "article" || block.kind === "h2") {
    return <h2 className="pt-2 text-[16px] font-black uppercase tracking-[0.01em]" style={{ color: articleColor }}>{block.text}</h2>;
  }
  if (block.kind === "h3") {
    return <h3 className="pt-1 text-[14px] font-black leading-5 text-slate-950">{block.text}</h3>;
  }
  if (block.kind === "h4") {
    return <h4 className="pt-1 text-[12px] font-bold uppercase tracking-[0.035em] text-slate-700">{block.text}</h4>;
  }
  if (block.kind === "subsection") {
    return <h3 className="pt-1 text-[13px] font-black leading-5 text-slate-950">{block.text}</h3>;
  }
  if (block.kind === "bullet") {
    return <p className="whitespace-pre-line pl-5 text-[12px] leading-[1.65] text-slate-700">{block.text}</p>;
  }
  return <p className="whitespace-pre-line text-[12px] leading-[1.7] text-slate-700">{block.text}</p>;
}

function ContractFooter'''
)

# SD05 rich heading syntax: H2/H3/H4 and markdown ##/###/####.
regex_once(
    "lib/sd05-contract.ts",
    r'export type ContractBlockKind = .*?export function contractPageCount\(content: SD05Content\) \{\n  return paginateContractBlocks\(content\.contractSummary\)\.length \+ 2;\n\}',
    '''export type ContractBlockKind = "major" | "article" | "h2" | "h3" | "h4" | "subsection" | "bullet" | "paragraph";
export type ContractRenderBlock = { text: string; kind: ContractBlockKind };

export function contractBodyBlocks(body: string): string[] {
  return body
    .split(/\\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
}

export function contractBlockKind(block: string): ContractBlockKind {
  const value = block.trim();
  if (/^(?:H2:\\s*|##\\s+)/i.test(value)) return "h2";
  if (/^(?:H3:\\s*|###\\s+)/i.test(value)) return "h3";
  if (/^(?:H4:\\s*|####\\s+)/i.test(value)) return "h4";
  if (/^(PRÉAMBULE|PREAMBULE|ENTRÉE EN VIGUEUR|ENTREE EN VIGUEUR|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE ET JURIDICTION)$/i.test(value)) return "major";
  if (/^(ARTICLE\\s+\\d+|ANNEXE\\s+\\d+)/i.test(value)) return "article";
  if (/^\\d+\\.\\d+\\.?\\s+/i.test(value)) return "subsection";
  if (/^(?:[-–•]\\s+)/.test(value)) return "bullet";
  return "paragraph";
}

function contractDisplayText(block: string) {
  return block.trim().replace(/^(?:H2:|H3:|H4:)\\s*/i, "").replace(/^#{2,4}\\s+/, "").trim();
}

export function isContractHeading(block: string) {
  const kind = contractBlockKind(block);
  return kind === "major" || kind === "article" || kind === "h2";
}

function blockWeight(block: ContractRenderBlock) {
  if (block.kind === "major" || block.kind === "article" || block.kind === "h2") return 1.35 + Math.ceil(block.text.length / 520) * 0.25;
  if (block.kind === "h3" || block.kind === "subsection") return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  if (block.kind === "h4") return 0.72 + Math.ceil(block.text.length / 650) * 0.22;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);
}

export function paginateContractBlocks(body: string): ContractRenderBlock[][] {
  const source = contractBodyBlocks(body).map(raw => ({ text: contractDisplayText(raw), kind: contractBlockKind(raw) }));
  if (!source.length) return [[]];
  const pages: ContractRenderBlock[][] = [];
  let page: ContractRenderBlock[] = [];
  let used = 0;
  const maxWeight = 6.2;
  for (const block of source) {
    const weight = blockWeight(block);
    if (page.length && used + weight > maxWeight) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(block);
    used += weight;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export function contractPageCount(content: SD05Content) {
  return paginateContractBlocks(content.contractSummary).length + 2;
}'''
)

# SD05 editor: explicit hierarchy controls, optional annex insertion and signed PDF download.
replace_once(
    "components/sd05-contract-builder.tsx",
    '  const removeTerm = (index: number) => setValue(current => ({ ...current, legalItems: current.legalItems.filter((_, currentIndex) => currentIndex !== index) }));\n',
    '''  const removeTerm = (index: number) => setValue(current => ({ ...current, legalItems: current.legalItems.filter((_, currentIndex) => currentIndex !== index) }));
  const appendContractBlock = (prefix: "H2:" | "H3:" | "H4:") => setValue(current => ({ ...current, contractSummary: `${current.contractSummary.trimEnd()}\\n\\n${prefix} `.trimStart() }));
  const addAnnex = () => setValue(current => {
    const matches = current.contractSummary.match(/^ANNEXE\\s+\\d+/gim) || [];
    const nextNumber = matches.length + 1;
    const addition = `ANNEXE ${nextNumber} : TITRE DE L'ANNEXE\\nTexte de l'annexe à compléter.`;
    return { ...current, contractSummary: `${current.contractSummary.trimEnd()}\\n\\n${addition}`.trim() };
  });
'''
)

replace_once(
    "components/sd05-contract-builder.tsx",
    '{locked ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé · version figée</Badge> : null}\n              <Button variant="outline" onClick={() => void save(false)} disabled={working || locked}>',
    '{locked ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Signé · version figée</Badge> : null}\n              {locked ? <Button variant="outline" asChild><a href={`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd05-pdf`}><Download className="mr-2 h-4 w-4" /> Télécharger le PDF</a></Button> : null}\n              <Button variant="outline" onClick={() => void save(false)} disabled={working || locked}>'
)

regex_once(
    "components/sd05-contract-builder.tsx",
    r'            <Card className="space-y-4 p-5">\n              <div><h2 className="font-semibold">Texte du contrat</h2>.*?\n            </Card>\n\n            <Card className="space-y-4 p-5">\n              <div><h2 className="font-semibold">Pied de page & confidentialité</h2>',
    '''            <Card className="space-y-4 p-5">
              <div><h2 className="font-semibold">Texte du contrat</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">La hiérarchie est désormais volontaire : utilisez H2, H3 et H4 pour contrôler le rendu juridique. Les formats « ARTICLE 1 », « 3.1. » et « ANNEXE 1 » restent également reconnus.</p></div>
              {!locked ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-2">
                <span className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Format</span>
                <Button type="button" variant="outline" size="sm" onClick={() => appendContractBlock("H2:")}>H2</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => appendContractBlock("H3:")}>H3</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => appendContractBlock("H4:")}>H4</Button>
                <Button type="button" variant="outline" size="sm" onClick={addAnnex}>+ Annexe</Button>
                <span className="ml-auto text-[10px] text-muted-foreground">Annexes facultatives</span>
              </div> : null}
              <Area disabled={locked} value={value.contractSummary} onChange={next => set("contractSummary", next)} rows={34} placeholder="H2: PRÉAMBULE\\n…\\n\\nH2: ARTICLE 1 — DÉFINITIONS\\n…\\n\\nH3: 1.1. Objet\\n…\\n\\nH4: Modalités pratiques\\n…" />
            </Card>

            <Card className="space-y-4 p-5">
              <div><h2 className="font-semibold">Pied de page & confidentialité</h2>'''
)

# Signature invitation now lives inside the public room under /contract. Existing /sign links remain valid.
replace_once(
    "app/api/deals/[id]/sd-room/sd05-signatures/route.ts",
    '      const signingUrl = `${request.nextUrl.origin}/sign/${encodeURIComponent(rawToken)}`;',
    '      const signingUrl = `${request.nextUrl.origin}/r/${encodeURIComponent(bundle.room.share_token)}/contract?s=${encodeURIComponent(rawToken)}`;'
)

write("app/r/[token]/contract/page.tsx", '''import { SD05SignaturePortal } from "@/components/sd05-signature-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  if (!s) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black text-slate-900">Invitation de signature requise</h1><p className="mt-3 text-sm leading-6 text-slate-600">Ouvrez le lien personnel reçu par email pour consulter et signer ce contrat.</p></div></main>;
  }
  return <SD05SignaturePortal token={s} />;
}
''')

# Dependency-free signed PDF generation for internal download.
write("app/api/deals/[id]/sd-room/sd05-pdf/route.ts", '''import { apiError } from "@/lib/hubspot";
import { contractBlockKind, contractBodyBlocks, normalizeSD05NativeContent } from "@/lib/sd05-contract";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfLine = { text: string; bold?: boolean; size?: number; gap?: number };

function normalizePdfText(value: string) {
  return value
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/€/g, "EUR").replace(/[^\\x09\\x0A\\x0D\\x20-\\xFF]/g, "?");
}

function escapePdf(value: string) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, width: number) {
  const words = normalizePdfText(value).split(/\\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdf(sourceLines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let used = 0;
  for (const line of sourceLines) {
    const size = line.size || 9;
    const wrapped = wrap(line.text, size >= 13 ? 78 : size >= 11 ? 92 : 108);
    for (let index = 0; index < wrapped.length; index += 1) {
      const item = { ...line, text: wrapped[index], gap: index === 0 ? line.gap : 0 };
      const height = (item.gap || 0) + Math.max(12, size + 4);
      if (page.length && used + height > 710) { pages.push(page); page = []; used = 0; }
      page.push(item); used += height;
    }
  }
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([{ text: "Contrat Gando" }]);

  const pageIds = pages.map((_, i) => 5 + i * 2);
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pages.forEach((lines, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    let y = 790;
    const commands: string[] = [];
    for (const line of lines) {
      y -= line.gap || 0;
      const size = line.size || 9;
      commands.push(`BT /${line.bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 48 ${y.toFixed(1)} Tm (${escapePdf(line.text)}) Tj ET`);
      y -= Math.max(12, size + 4);
    }
    commands.push(`BT /F1 7 Tf 1 0 0 1 48 28 Tm (GANDO SOLUTIONS - Document signe - Page ${pageIndex + 1} / ${pages.length}) Tj ET`);
    const stream = commands.join("\\n");
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\\nstream\\n${stream}\\nendstream`);
  });

  const maxId = Math.max(...objects.keys());
  let pdf = "%PDF-1.4\\n%âãÏÓ\\n";
  const offsets = [0];
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\\n${objects.get(id) || "<<>>"}\\nendobj\\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\\n0 ${maxId + 1}\\n0000000000 65535 f \\n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \\n`;
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const document = bundle.documents.find(item => item.code === "SD05");
    if (!document) throw Object.assign(new Error("SD05 introuvable."), { status: 404 });
    const content = normalizeSD05NativeContent(document.content);
    if (content.contractStatus !== "signed" || document.status !== "validated") throw Object.assign(new Error("Le PDF est disponible uniquement lorsque le contrat est signé."), { status: 409 });

    const { data: signatures, error } = await getSupabaseAdmin().from("sd_contract_signature_requests")
      .select("signer_name,signer_email,signer_role,signer_organization,signature_name,signature_mode,signed_at,contract_hash,signed_payload_hash")
      .eq("document_id", document.id).eq("status", "signed").order("signed_at", { ascending: true });
    if (error) throw error;

    const lines: PdfLine[] = [
      { text: "GANDO SOLUTIONS", bold: true, size: 10 },
      { text: content.contractTitle || "Contrat Gando", bold: true, size: 17, gap: 14 },
      { text: `${content.contractReference || "Sans référence"} - ${content.contractVersion || "Version non renseignée"}`, size: 9, gap: 4 },
      { text: `Partenaire / client : ${bundle.room.company_name}`, bold: true, size: 10, gap: 16 },
      { text: `Mise en production : ${content.goLiveDate || content.effectiveDate || "À compléter"}` },
      { text: `Durée : ${content.term || "À compléter"}` },
      { text: `Renouvellement : ${content.renewal || "À compléter"}` },
      { text: `Préavis / résiliation : ${content.terminationNotice || "À compléter"}` },
    ];
    if (content.legalItems.length) {
      lines.push({ text: "CONDITIONS PARTICULIÈRES", bold: true, size: 12, gap: 18 });
      for (const item of content.legalItems) lines.push({ text: `${item.topic} : ${item.notes || "À compléter"}`, gap: 3 });
    }
    lines.push({ text: "CONTRAT", bold: true, size: 12, gap: 18 });
    for (const raw of contractBodyBlocks(content.contractSummary)) {
      const kind = contractBlockKind(raw);
      const text = raw.replace(/^(?:H2:|H3:|H4:)\\s*/i, "").replace(/^#{2,4}\\s+/, "").trim();
      lines.push({ text, bold: ["major", "article", "h2", "h3", "h4", "subsection"].includes(kind), size: ["major", "article", "h2"].includes(kind) ? 11 : ["h3", "subsection"].includes(kind) ? 10 : 9, gap: ["major", "article", "h2"].includes(kind) ? 12 : 5 });
    }
    lines.push({ text: "SIGNATURES ÉLECTRONIQUES", bold: true, size: 12, gap: 20 });
    for (const signature of signatures || []) {
      lines.push({ text: `${signature.signer_organization || "Organisation"} - ${signature.signature_name || signature.signer_name} - ${signature.signer_role || ""}`, bold: true, size: 10, gap: 8 });
      lines.push({ text: `Signé le ${signature.signed_at ? new Date(signature.signed_at).toLocaleString("fr-FR") : "-"} - mode ${signature.signature_mode === "drawn" ? "manuscrit" : "écrit"}` });
      lines.push({ text: `Email : ${signature.signer_email}` });
      lines.push({ text: `Empreinte document SHA-256 : ${signature.contract_hash}` });
      lines.push({ text: `Empreinte preuve SHA-256 : ${signature.signed_payload_hash || "-"}` });
    }
    lines.push({ text: content.footerConfidentialityText, size: 7, gap: 18 });

    const pdf = buildPdf(lines);
    const safe = String(content.contractReference || "SD05-signe").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${safe}.pdf"`, "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
''')

# SD04 upload/delete endpoint.
write("app/api/deals/[id]/sd-room/sd04-pdf/route.ts", '''import { NextRequest } from "next/server";
import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { createEmptySD04 } from "@/lib/sd-stage-content";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "sd-room-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "deal";
}

function pathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split(/[?#]/)[0] || "");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) throw Object.assign(new Error("Ajoutez un fichier PDF."), { status: 400 });
    const file = entry;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw Object.assign(new Error("Le SD04 accepte uniquement un fichier PDF."), { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) throw Object.assign(new Error("Le PDF doit faire moins de 20 Mo."), { status: 400 });
    const supabase = getSupabaseAdmin();
    const bucket = await supabase.storage.getBucket(BUCKET);
    if (!bucket.data) {
      const created = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: ["application/pdf"] });
      if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
    }
    const path = `sd04/${safeSegment(id)}/${Date.now()}-${crypto.randomUUID()}.pdf`;
    const uploaded = await supabase.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: "application/pdf", cacheControl: "3600", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.data.path);
    return Response.json({ url: data.publicUrl, name: file.name });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const body = await request.json().catch(() => ({}));
    const url = String(body?.url || "");
    const path = pathFromPublicUrl(url);
    const admin = getSupabaseAdmin();
    if (path) {
      const removed = await admin.storage.from(BUCKET).remove([path]);
      if (removed.error) throw removed.error;
    }
    const empty = createEmptySD04();
    const { error } = await admin.from("sd_documents").update({ content: empty, published_content: null, status: "draft", published_at: null, published_version: null }).eq("room_id", bundle.room.id).eq("code", "SD04");
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
''')

write("components/sd04-offer-builder.tsx", '''"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Save, Send, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createEmptySD04, type SD04Content } from "@/lib/sd-stage-content";
import type { SDDocumentRecord } from "@/lib/sd-room-types";

type RoomResponse = { documents: SDDocumentRecord[]; room: { id: string; title: string } | null };
const isPdfUrl = (value: string) => /^https?:\\/\\//i.test(value || "");

export function SD04OfferBuilder({ dealId }: { dealId: string }) {
  const [data, setData] = useState<RoomResponse | null>(null);
  const [value, setValue] = useState<SD04Content>(createEmptySD04());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Chargement impossible");
      setData(payload);
      const document = payload.documents.find((item: SDDocumentRecord) => item.code === "SD04");
      setValue({ ...createEmptySD04(), ...((document?.content || {}) as Partial<SD04Content>) });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [dealId]);
  useEffect(() => { void load(); }, [load]);

  const sd02Validated = data?.documents.find(item => item.code === "SD02")?.status === "validated";
  const sd04 = data?.documents.find(item => item.code === "SD04");
  const pdfUrl = isPdfUrl(value.deckSubtitle) ? value.deckSubtitle : "";
  const pdfName = value.deckTitle || "Offre commerciale.pdf";

  async function uploadPdf(file: File) {
    if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) return toast.error("Sélectionnez un fichier PDF.");
    if (file.size > 20 * 1024 * 1024) return toast.error("Le PDF doit faire moins de 20 Mo.");
    setUploading(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd04-pdf`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Import du PDF impossible");
      setValue({ ...createEmptySD04(), deckTitle: payload.name || file.name, deckSubtitle: payload.url || "" });
      toast.success("PDF importé. Vous pouvez le relire avant de publier.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import impossible"); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function save(publish: boolean) {
    if (!pdfUrl) return toast.error("Ajoutez d’abord le PDF du SD04.");
    setWorking(true);
    try {
      const content: SD04Content = { ...createEmptySD04(), deckTitle: pdfName, deckSubtitle: pdfUrl };
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "SD04", content, publish }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Enregistrement impossible");
      setData(current => current ? { ...current, documents: current.documents.map(document => document.code === "SD04" ? payload.document : document) } : current);
      setValue({ ...createEmptySD04(), ...(payload.document?.content || {}) });
      toast.success(publish ? "PDF SD04 publié dans la Room" : "PDF SD04 enregistré");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible"); }
    finally { setWorking(false); }
  }

  async function removePdf() {
    if (!pdfUrl || working) return;
    if (!window.confirm("Supprimer ce PDF du SD04 ? Il ne sera plus visible dans la Room.")) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/sd04-pdf`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: pdfUrl }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "Suppression impossible");
      setValue(createEmptySD04());
      toast.success("PDF supprimé du SD04");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); }
    finally { setWorking(false); }
  }

  if (loading && !data) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="page-shell min-h-screen p-5 lg:p-7"><div className="mx-auto max-w-[1180px] space-y-5">
    <Card className="overflow-hidden p-0"><div className="flex flex-col gap-4 border-b border-border bg-primary/[0.04] p-5 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SD04 · PDF commercial</div><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Offre commerciale</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Importez le PDF, relisez-le dans un lecteur propre puis publiez-le dans la Room.</p></div></div><div className="flex flex-wrap items-center gap-2 lg:ml-auto">{sd04?.status === "validated" ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validé client</Badge> : null}<Button variant="outline" onClick={() => void save(false)} disabled={working || uploading || !pdfUrl}><Save className="mr-2 h-4 w-4" /> Enregistrer</Button><Button onClick={() => void save(true)} disabled={working || uploading || !pdfUrl || !sd02Validated}><Send className="mr-2 h-4 w-4" /> Publier</Button></div></div>{!sd02Validated ? <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-700">SD02 doit être validé avant de publier SD04.</div> : null}</Card>

    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadPdf(file); }} />
    {!pdfUrl ? <Card className="p-5 sm:p-7"><button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] disabled:opacity-60">{uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-9 w-9 text-primary" />}<div className="mt-4 text-base font-semibold">{uploading ? "Import du PDF…" : "Importer le PDF du SD04"}</div><div className="mt-1 text-sm text-muted-foreground">PDF uniquement · 20 Mo maximum</div></button></Card> : null}

    {pdfUrl ? <Card className="overflow-hidden p-0"><div className="flex flex-col gap-3 border-b border-border bg-slate-950 px-4 py-3 text-white sm:flex-row sm:items-center"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{pdfName}</div><div className="text-[11px] text-slate-400">Aperçu du document partagé au client</div></div><Button size="sm" variant="secondary" asChild><a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ouvrir</a></Button><Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>Remplacer</Button><Button size="sm" variant="destructive" onClick={() => void removePdf()} disabled={working}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer</Button></div><div className="bg-[#eef0f2] p-3 sm:p-5"><div className="mx-auto max-w-[940px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"><iframe src={pdfUrl} title={pdfName} className="h-[760px] w-full bg-white" /></div></div></Card> : null}
  </div></div>;
}
''')

# Cleaner public SD04 reader without touching the other SD stages.
regex_once(
    "components/public-sd-room-v6.tsx",
    r'function SD04Document\(\{ content \}: \{ content: SD04Content \}\) \{.*?\n\}\n\nfunction SD05Document',
    '''function SD04Document({ content }: { content: SD04Content }) {
  const pdfUrl = /^https?:\\/\\//i.test(content.deckSubtitle || "") ? content.deckSubtitle : "";
  const fileName = content.deckTitle || "Offre commerciale.pdf";
  return <div className="space-y-5 sm:space-y-6"><Section title="Document commercial" kicker="SD04 · PDF commercial">
    {pdfUrl ? <div className="overflow-hidden rounded-[16px] border border-[#d9dee1] bg-[#eef0f2] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#20282d] px-4 py-3 text-white sm:flex-row sm:items-center"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{fileName}</div><div className="mt-0.5 text-[11px] text-white/55">Document PDF partagé par Gando</div></div><a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-[#20282d]"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir en plein écran</a></div>
      <div className="p-2 sm:p-4"><iframe src={pdfUrl} title={fileName} className="hidden h-[780px] w-full rounded-lg border border-[#d9dee1] bg-white md:block" /><div className="grid min-h-40 place-items-center rounded-lg bg-white p-6 text-center md:hidden"><div><FileText className="mx-auto h-8 w-8 text-[#7166c7]" /><p className="mt-3 text-sm text-[#687277]">Ouvrez le PDF en plein écran pour une lecture confortable.</p></div></div></div>
    </div> : <p className="italic text-[#81898e]">Aucun PDF n’a encore été publié.</p>}
  </Section></div>;
}

function SD05Document'''
)

# Remove the legacy internal War Room by redirecting directly to the SD workspace.
write("app/(cockpit)/deal-room/[id]/page.tsx", '''import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/deal-room/${encodeURIComponent(id)}/sd`);
}
''')

# Per-document engagement metrics for SD01 through SD05.
write("app/api/deals/[id]/sd-room/document-analytics/route.ts", '''import { apiError } from "@/lib/hubspot";
import { getSDRoomBundle } from "@/lib/sd-room";
import { requireSDInternalAccess } from "@/lib/sd-room-access";
import { SD_CODES } from "@/lib/sd-room-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireSDInternalAccess();
    const bundle = await getSDRoomBundle(id);
    if (!bundle.room) throw Object.assign(new Error("Room SD introuvable."), { status: 404 });
    const { data, error } = await getSupabaseAdmin().from("deal_room_events")
      .select("document_code,visitor_email,session_id,event_type,created_at")
      .eq("room_id", bundle.room.id).not("document_code", "is", null).order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    const result = Object.fromEntries(SD_CODES.map(code => {
      const rows = (data || []).filter(row => row.document_code === code && row.event_type === "stage_viewed");
      const sessions = new Set(rows.map(row => String(row.session_id || row.visitor_email || "")).filter(Boolean));
      return [code, { visits: rows.length, opens: sessions.size, lastViewedAt: rows[0]?.created_at || null }];
    }));
    return Response.json({ documents: result });
  } catch (error) { return apiError(error); }
}
''')

write("components/sd-document-analytics-strip.tsx", '''"use client";

import { useEffect, useState } from "react";
import { Clock3, Eye, Loader2, MousePointerClick } from "lucide-react";
import type { SDCode } from "@/lib/sd-room-types";

type Metric = { visits: number; opens: number; lastViewedAt: string | null };
type Payload = { documents?: Partial<Record<SDCode, Metric>> };

function date(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function SDDocumentAnalyticsStrip({ dealId, code }: { dealId: string; code: SDCode }) {
  const [metric, setMetric] = useState<Metric | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/deals/${encodeURIComponent(dealId)}/sd-room/document-analytics`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((payload: Payload) => { if (active) setMetric(payload.documents?.[code] || { visits: 0, opens: 0, lastViewedAt: null }); })
      .catch(() => { if (active) setMetric({ visits: 0, opens: 0, lastViewedAt: null }); });
    return () => { active = false; };
  }, [code, dealId]);
  if (!metric) return <div className="flex h-10 items-center border-b border-border px-5 text-xs text-muted-foreground lg:px-7"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Statistiques de consultation…</div>;
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground lg:px-7"><span className="font-black uppercase tracking-[0.12em] text-foreground">{code}</span><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Visites <strong className="text-foreground">{metric.visits}</strong></span><span className="inline-flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5 text-primary" /> Ouvertures <strong className="text-foreground">{metric.opens}</strong></span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> Dernière consultation <strong className="text-foreground">{date(metric.lastViewedAt)}</strong></span></div>;
}
''')

write("components/sd-room-workspace.tsx", '''"use client";

import { useState } from "react";
import { Eye, FileSignature, FileText, ListChecks, Palette, Presentation, Settings2 } from "lucide-react";
import { SD02PlanBuilder } from "@/components/sd02-plan-builder";
import { SD03SolutionBuilder } from "@/components/sd03-solution-builder";
import { SD04OfferBuilder } from "@/components/sd04-offer-builder";
import { SD05ContractBuilder } from "@/components/sd05-contract-builder";
import { SDDocumentAnalyticsStrip } from "@/components/sd-document-analytics-strip";
import { SDRoomBrandingEditorV2 } from "@/components/sd-room-branding-editor-v2";
import { SDRoomEditor } from "@/components/sd-room-editor";
import { SDRoomPreview } from "@/components/sd-room-preview";
import type { SDCode } from "@/lib/sd-room-types";
import { cn } from "@/lib/utils";

type WorkspaceTab = "content" | "plan" | "solution" | "offer" | "contract" | "branding" | "preview";
const CODE_BY_TAB: Partial<Record<WorkspaceTab, SDCode>> = { content: "SD01", plan: "SD02", solution: "SD03", offer: "SD04", contract: "SD05" };

export function SDRoomWorkspace({ dealId }: { dealId: string }) {
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const tabs: Array<{ value: WorkspaceTab; label: string; icon: typeof FileText }> = [
    { value: "content", label: "SD01 · Synthèse", icon: FileText },
    { value: "plan", label: "SD02 · Plan d’action", icon: ListChecks },
    { value: "solution", label: "SD03 · Solution", icon: Settings2 },
    { value: "offer", label: "SD04 · PDF commercial", icon: Presentation },
    { value: "contract", label: "SD05 · Contrat & signature", icon: FileSignature },
    { value: "branding", label: "Branding", icon: Palette },
    { value: "preview", label: "Prévisualisation", icon: Eye },
  ];
  const analyticsCode = CODE_BY_TAB[tab];
  return <div className="min-h-screen bg-background"><div className="sticky top-0 z-[60] border-b border-border bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-5 py-2 lg:px-7">{tabs.map(item => { const Icon = item.icon; return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors", tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {item.label}</button>; })}<span className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block">Room SD · Gando</span></div></div>{analyticsCode ? <SDDocumentAnalyticsStrip dealId={dealId} code={analyticsCode} /> : null}{tab === "content" ? <SDRoomEditor dealId={dealId} /> : tab === "plan" ? <SD02PlanBuilder dealId={dealId} /> : tab === "solution" ? <SD03SolutionBuilder dealId={dealId} /> : tab === "offer" ? <SD04OfferBuilder dealId={dealId} /> : tab === "contract" ? <SD05ContractBuilder dealId={dealId} /> : tab === "branding" ? <SDRoomBrandingEditorV2 dealId={dealId} /> : <SDRoomPreview dealId={dealId} />}</div>;
}
''')

replace_once(
    "components/sd-room-branding-editor-v2.tsx",
    '<div><Label>Sous-titre</Label><textarea value={subtitle}',
    '<div><Label>Sous-titre de la bannière</Label><textarea value={subtitle}'
)

print("SD room polish applied")
