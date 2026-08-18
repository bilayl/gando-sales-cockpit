"use client";

import { ExternalLink, Loader2, Mail, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PostCallEmailButtonProps = {
  contactId: string;
  callId?: string;
  email: string;
  firstName?: string;
  companyName?: string;
  senderName?: string;
  callTitle?: string;
  callBody?: string;
  transcription: string;
  onSent?: () => void;
};

export function PostCallEmailButton({
  contactId,
  callId,
  email,
  firstName,
  companyName,
  senderName,
  callTitle,
  callBody,
  transcription,
  onSent,
}: PostCallEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(email);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);

  async function generateDraft() {
    setGenerating(true);
    setNeedsGoogleAuth(false);
    try {
      const response = await fetch("/api/post-call-email/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, companyName, senderName, callTitle, callBody, transcription }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Impossible de générer l'email");
      setSubject(payload.subject || "Suite à notre échange — Gando");
      setBody(payload.body || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de générer l'email");
    } finally {
      setGenerating(false);
    }
  }

  async function openComposer() {
    setTo(email);
    setOpen(true);
    if (!subject || !body) await generateDraft();
  }

  function openInGmail() {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: to.trim(),
      su: subject.trim(),
      body: body.trim().replace(/\*\*(.+?)\*\*/g, "$1"),
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  async function logSentEmail() {
    try {
      const marker = callId ? `[GANDO_POST_CALL_EMAIL:${callId}]\n` : "";
      const note = `${marker}Email de récap après appel envoyé à ${to.trim()}\n\nObjet : ${subject.trim()}\n\n${body.trim()}`;
      await fetch(`/api/contacts/${contactId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", properties: { hs_note_body: note } }),
      });
    } catch {
      // L'envoi de l'email reste prioritaire ; la synchro HubSpot pourra être refaite ensuite.
    }
  }

  async function sendEmail() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Destinataire, objet et contenu sont requis.");
      return;
    }
    setSending(true);
    setNeedsGoogleAuth(false);
    try {
      const response = await fetch("/api/post-call-email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.reauthRequired) setNeedsGoogleAuth(true);
        throw new Error(payload.error || "Impossible d'envoyer l'email");
      }
      await logSentEmail();
      toast.success("Email de récap envoyé et journalisé dans HubSpot.");
      setOpen(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer l'email");
    } finally {
      setSending(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Fermer" />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-[0_30px_90px_-30px_rgba(15,35,42,0.65)] sm:p-6">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fermer">
          <X size={16} />
        </button>

        <div className="pr-10">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles size={16} /> Suivi après appel</div>
          <h3 className="mt-1 text-xl font-bold tracking-tight">Email de récap au prospect</h3>
          <p className="mt-1 text-sm text-muted-foreground">Le brouillon est synthétisé uniquement à partir de la transcription/note disponible. Les éléments entre ** ** seront envoyés en gras. Vous pouvez tout modifier avant l'envoi.</p>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="space-y-1.5">
            <Label>Destinataire</Label>
            <Input type="email" value={to} onChange={event => setTo(event.target.value)} placeholder="prospect@entreprise.fr" />
          </div>
          <div className="space-y-1.5">
            <Label>Objet</Label>
            <Input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Suite à notre échange — Gando" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label>Message</Label>
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" disabled={generating} onClick={generateDraft}>
                {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Régénérer
              </Button>
            </div>
            <textarea
              value={body}
              onChange={event => setBody(event.target.value)}
              className="min-h-[260px] w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-6 text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary/55 focus:ring-2 focus:ring-ring/15"
              placeholder={generating ? "Génération du récap…" : "Le contenu du récap apparaîtra ici."}
            />
          </div>
        </div>

        {needsGoogleAuth ? (
          <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            Google doit être reconnecté une fois pour autoriser l'envoi Gmail. Vous pouvez aussi ouvrir ce brouillon dans Gmail immédiatement.
            <div className="mt-2"><Button asChild size="sm" variant="outline"><a href="/api/auth/google"><ExternalLink size={14} /> Reconnecter Google</a></Button></div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={openInGmail} disabled={!to.trim() || !subject.trim() || !body.trim()}>
            <ExternalLink size={15} /> Ouvrir dans Gmail
          </Button>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" className="gap-1.5" onClick={sendEmail} disabled={sending || generating || !to.trim() || !subject.trim() || !body.trim()}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={openComposer}>
        <Mail size={13} /> Email de récap
      </Button>
      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
