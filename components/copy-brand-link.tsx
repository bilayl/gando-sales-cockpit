"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyBrandLink({ href = "/brand", label = "Copier le lien partenaire" }: { href?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = href.startsWith("http") ? href : `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Lien copié" : label}
    </button>
  );
}
