"use client";

import { Download } from "lucide-react";
import { svgDataUrl } from "@/lib/gando-brand";

type Props = {
  svg: string;
  fileName: string;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPng(svg: string, fileName: string) {
  const parser = new DOMParser();
  const documentSvg = parser.parseFromString(svg, "image/svg+xml");
  const root = documentSvg.documentElement;
  const viewBox = root.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const sourceWidth = viewBox?.[2] || Number(root.getAttribute("width")) || 1000;
  const sourceHeight = viewBox?.[3] || Number(root.getAttribute("height")) || 1000;
  const maxDimension = sourceWidth > sourceHeight ? 1800 : 1200;
  const scale = maxDimension / Math.max(sourceWidth, sourceHeight);

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Impossible de générer le PNG."));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas indisponible.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("PNG indisponible.")), "image/png", 1);
  });

  downloadBlob(pngBlob, fileName.replace(/\.svg$/i, ".png"));
}

export function BrandAssetDownloads({ svg, fileName }: Props) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <a
        href={svgDataUrl(svg)}
        download={fileName}
        className="inline-flex items-center gap-2 rounded-lg bg-[#004855] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#003b46]"
      >
        <Download className="h-3.5 w-3.5" /> SVG
      </a>
      <button
        type="button"
        onClick={() => void downloadPng(svg, fileName)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5" /> PNG
      </button>
    </div>
  );
}
