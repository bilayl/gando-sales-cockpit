"use client";

import { useState } from "react";
import { ExternalLink, Loader2, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONOFF_WEBPHONE_URL = "https://phone.onoffbusiness.com/";
const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

export function OnoffWebPhone({ compact = false }: { compact?: boolean }) {
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#eef5f1] text-[#2f5e49] dark:bg-muted dark:text-foreground">
            <PhoneCall className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.02em]">Téléphone Onoff</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Webphone officiel embarqué · test navigateur</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { setLoaded(false); setFrameKey(value => value + 1); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Recharger
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">Ouvrir Onoff <ExternalLink className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
      </div>

      <div className="relative bg-background">
        {!loaded ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/70 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement de l’application Onoff…
            </div>
          </div>
        ) : null}
        <iframe
          key={frameKey}
          src={ONOFF_WEBPHONE_URL}
          title="Onoff Business Webphone"
          allow="microphone; autoplay; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          className={compact ? "h-[620px] w-full bg-white" : "h-[calc(100vh-150px)] min-h-[680px] w-full bg-white"}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/15 px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Le micro est délégué au webphone Onoff dans l’iframe.</span>
        <a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
          Extension Click2Call Onoff <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
