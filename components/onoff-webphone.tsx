"use client";

import { ExternalLink, MousePointerClick, PhoneCall, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONOFF_WEBPHONE_URL = "https://phone.onoffbusiness.com/";
const ONOFF_EXTENSION_URL = "https://chromewebstore.google.com/detail/onoff-business-click2call/jbfkkljambdhjlkcfkcbpjfkkamkccfm";

export function OnoffWebPhone({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#eef5f1] text-[#2f5e49] dark:bg-muted dark:text-foreground">
            <PhoneCall className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.02em]">Téléphonie Onoff</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Application web officielle + Click2Call dans le Cockpit</div>
          </div>
        </div>
      </div>

      <div className={compact ? "grid gap-3 p-4" : "grid gap-4 p-5 lg:grid-cols-2 lg:p-6"}>
        <div className="rounded-[18px] border border-border bg-background p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <PhoneCall className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[14px] font-semibold">Application web Onoff</div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                Ouvre le webphone Onoff dans sa fenêtre officielle pour les appels, le micro et l’audio.
              </p>
            </div>
          </div>
          <Button asChild className="mt-4 h-9 gap-1.5">
            <a href={ONOFF_WEBPHONE_URL} target="_blank" rel="noreferrer">
              Ouvrir Onoff Business <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>

        <div className="rounded-[18px] border border-border bg-background p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <MousePointerClick className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[14px] font-semibold">Click2Call dans Gando</div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                L’extension officielle Onoff est la voie prévue pour déclencher un appel depuis une page web du Cockpit.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 h-9 gap-1.5">
            <a href={ONOFF_EXTENSION_URL} target="_blank" rel="noreferrer">
              Installer Click2Call <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-muted/15 px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          L’iframe Onoff a été désactivée : l’embarquement de leur webapp n’est pas un mode officiellement documenté et peut casser l’authentification, les cookies ou l’accès au micro. Gando conserve l’API et les webhooks Onoff pour les données d’appel et le suivi CRM.
        </span>
      </div>
    </div>
  );
}
