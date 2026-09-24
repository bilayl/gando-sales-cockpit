import { contractPrintHtml } from "@/lib/contract-rich-text";
import { buildBrandedSD05Pdf } from "@/lib/sd05-pdf";
import type { SD05Content } from "@/lib/sd-stage-content";

function gotenbergUrl() {
  return String(process.env.GOTENBERG_URL || "").trim().replace(/\/$/, "");
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function visualPdfConfigured() {
  return Boolean(gotenbergUrl());
}

export async function renderVisualContractPdf(input: { content: SD05Content; companyName: string }) {
  const { content, companyName } = input;
  if (!content.contractHtml || !gotenbergUrl()) {
    return new Uint8Array(buildBrandedSD05Pdf({ content, companyName, signatures: [] }));
  }

  const html = contractPrintHtml({ content, companyName });
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html;charset=utf-8" }), "index.html");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");

  const response = await fetch(`${gotenbergUrl()}/forms/chromium/convert/html`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Génération PDF visuelle impossible (${response.status}).`), { status: 502 });
  }
  return new Uint8Array(await response.arrayBuffer());
}

export { toArrayBuffer };
