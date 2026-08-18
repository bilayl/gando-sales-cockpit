"use client";

import { ChevronDown, ChevronUp, Loader2, MailCheck, PhoneCall, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostCallEmailButton } from "@/components/post-call-email-button";
import { POST_CALL_EMAIL_LABELS, type PostCallEmailKind } from "@/lib/post-call-email-types";

type Candidate = {
  callId: string;
  contactId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  callTitle?: string;
  callBody?: string;
  transcription: string;
  emailRequested?: boolean;
  recommendedKind: PostCallEmailKind;
  emailReason?: string;
  occurredAt?: string | null;
  outcome?: string;
};

function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function PostCallFollowupQueue({ senderName }: { senderName?: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/post-call-email/candidates", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de charger les emails à envoyer");
      setCandidates(payload.candidates || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les emails à envoyer");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="fixed bottom-4 right-4 z-[80] w-[min(420px,calc(100vw-2rem))]">
      {open ? (
        <div className="mb-2 max-h-[min(70vh,650px)] overflow-hidden rounded-xl border border-border bg-popover shadow-[0_22px_65px_-24px_rgba(15,35,42,0.5)]">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={15} className="text-primary" /> Emails à envoyer</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Détection automatique : post-démo, tarifs ou premier contact gérant</div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void load()} disabled={loading} aria-label="Actualiser">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </Button>
          </div>

          <div className="max-h-[min(60vh,550px)] overflow-y-auto p-3 minari-scrollbar">
            {error ? <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
            {!error && loading && candidates.length === 0 ? <div className="grid h-24 place-items-center"><Loader2 className="animate-spin text-primary" /></div> : null}
            {!error && !loading && candidates.length === 0 ? <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun email prioritaire détecté pour le moment. Les appels transcrits seront analysés automatiquement.</div> : null}
            <div className="space-y-2">
              {candidates.map(candidate => {
                const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || candidate.email;
                return (
                  <div key={`${candidate.callId}-${candidate.contactId}`} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{fullName}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{candidate.companyName || candidate.email}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className="text-[10px]">{POST_CALL_EMAIL_LABELS[candidate.recommendedKind]}</Badge>
                        {candidate.outcome ? <Badge variant="outline" className="max-w-[145px] truncate text-[10px]">{candidate.outcome}</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><PhoneCall size={12} className="text-primary" /> <span className="truncate">{candidate.callTitle || "Appel"}</span>{candidate.occurredAt ? <span>· {formatWhen(candidate.occurredAt)}</span> : null}</div>
                    {candidate.emailReason ? <p className="mt-2 rounded-md bg-primary/5 px-2.5 py-2 text-xs leading-5 text-foreground">{candidate.emailReason}</p> : null}
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{candidate.transcription}</p>
                    <div className="mt-3 flex justify-end">
                      <PostCallEmailButton
                        contactId={candidate.contactId}
                        callId={candidate.callId}
                        email={candidate.email}
                        firstName={candidate.firstName}
                        companyName={candidate.companyName}
                        senderName={senderName}
                        callTitle={candidate.callTitle}
                        callBody={candidate.callBody}
                        transcription={candidate.transcription}
                        emailKind={candidate.recommendedKind}
                        onSent={() => void load()}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="ml-auto flex min-h-11 items-center gap-2 rounded-full border border-primary/25 bg-popover px-4 py-2.5 text-sm font-semibold shadow-[0_12px_36px_-18px_rgba(15,35,42,0.6)] transition hover:bg-accent"
      >
        {loading ? <Loader2 size={15} className="animate-spin text-primary" /> : <MailCheck size={16} className="text-primary" />}
        <span>Emails à envoyer</span>
        {candidates.length ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{candidates.length}</span> : null}
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
      </button>
    </div>
  );
}
