"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ContactDrawer as ContactDrawerBase } from "@/components/contact-drawer-base";
import { PostCallEmailButton } from "@/components/post-call-email-button";
import { ProfileSourcingOverlay } from "@/components/profile-sourcing-overlay";

type Props = {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

type ContactContext = {
  contact?: { properties?: Record<string, string> };
  companies?: Array<{ properties?: Record<string, string> }>;
  notes?: Array<{ id?: string; createdAt?: string; properties?: Record<string, string> }>;
  calls?: Array<{ id?: string; createdAt?: string; properties?: Record<string, string> }>;
};

const PROSPECTION_DIRTY_KEY = "gando:prospection-company-dirty";

function noteBodyText(value?: string) {
  return (value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function ContactNotesEmailAction({
  contactId,
  open,
  refreshToken,
  onSent,
}: {
  contactId: string | null;
  open: boolean;
  refreshToken: number;
  onSent: () => void;
}) {
  const [data, setData] = useState<ContactContext | null>(null);

  useEffect(() => {
    if (!open || !contactId) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/contacts/${contactId}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les notes");
        return payload as ContactContext;
      })
      .then(setData)
      .catch(error => {
        if ((error as Error).name !== "AbortError") setData(null);
      });

    return () => controller.abort();
  }, [contactId, open, refreshToken]);

  const emailContext = useMemo(() => {
    const notes = (data?.notes || [])
      .map(note => ({
        id: note.id,
        date: note.properties?.hs_timestamp || note.createdAt || "",
        body: noteBodyText(note.properties?.hs_note_body),
      }))
      .filter(note => note.body && !note.body.startsWith("[GANDO_POST_CALL_EMAIL:"))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!notes.length) return null;

    const transcription = notes
      .slice(0, 5)
      .map((note, index) => `${index === 0 ? "Dernière note commerciale" : `Note précédente ${index}`} :\n${note.body}`)
      .join("\n\n")
      .slice(0, 12000);

    const latestCall = (data?.calls || [])
      .slice()
      .sort((a, b) => String(b.properties?.hs_timestamp || b.createdAt || "").localeCompare(String(a.properties?.hs_timestamp || a.createdAt || "")))[0];

    return {
      transcription,
      callId: latestCall?.id,
      callTitle: latestCall?.properties?.hs_call_title || "Récapitulatif des notes commerciales",
      callBody: latestCall?.properties?.hs_call_body || "",
    };
  }, [data]);

  if (!open || !contactId || !data || !emailContext) return null;

  const contact = data.contact?.properties || {};
  const email = contact.email || "";
  if (!email) return null;

  const companyName = data.companies?.[0]?.properties?.name || contact.company || "";

  return (
    <div className="fixed bottom-5 right-5 z-[125] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-xl border border-border bg-popover p-2.5 shadow-xl">
      <div className="hidden min-w-0 sm:block">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <FileText size={13} /> Récap notes
        </div>
        <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">Générer un e-mail à partir des dernières notes commerciales.</p>
      </div>
      <PostCallEmailButton
        contactId={contactId}
        callId={emailContext.callId}
        email={email}
        firstName={contact.firstname}
        companyName={companyName}
        callTitle={emailContext.callTitle}
        callBody={emailContext.callBody}
        transcription={emailContext.transcription}
        buttonLabel="Générer l’e-mail"
        buttonClassName="h-9 gap-1.5 px-3 text-xs"
        onSent={onSent}
      />
    </div>
  );
}

export function ContactDrawer(props: Props) {
  const { contactId, open, onUpdated } = props;
  const [refreshKey, setRefreshKey] = useState(0);
  const [emailRefreshKey, setEmailRefreshKey] = useState(0);

  function flagProspectionRefresh() {
    if (typeof window !== "undefined") window.sessionStorage.setItem(PROSPECTION_DIRTY_KEY, "1");
  }

  async function handleCompleted() {
    setRefreshKey(value => value + 1);
    setEmailRefreshKey(value => value + 1);
    flagProspectionRefresh();
    onUpdated?.();
  }

  function handleUpdated() {
    setEmailRefreshKey(value => value + 1);
    flagProspectionRefresh();
    onUpdated?.();
  }

  function handleEmailSent() {
    setRefreshKey(value => value + 1);
    setEmailRefreshKey(value => value + 1);
    flagProspectionRefresh();
    onUpdated?.();
  }

  return (
    <>
      <ContactDrawerBase
        key={`${contactId || "none"}-${refreshKey}`}
        {...props}
        onUpdated={handleUpdated}
      />
      <ContactNotesEmailAction
        contactId={contactId}
        open={open}
        refreshToken={emailRefreshKey}
        onSent={handleEmailSent}
      />
      <ProfileSourcingOverlay
        open={open}
        entityType="contact"
        entityId={contactId}
        onCompleted={handleCompleted}
      />
    </>
  );
}
