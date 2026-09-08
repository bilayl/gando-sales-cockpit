"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Phone, PhoneOff, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Contact = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

type AlloStatus = {
  directCallReady?: boolean;
  team?: { name?: string } | null;
  target?: { email?: string | null; name?: string | null } | null;
};

function fullName(contact: Contact) {
  const p = contact.properties;
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Contact sans nom";
}

function phoneOf(contact: Contact) {
  return String(contact.properties.mobilephone || contact.properties.phone || "").trim();
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function InWebCallWorkspace({
  contact,
  allo,
  onClose,
}: {
  contact: Contact;
  allo: AlloStatus | null;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    if (!sessionStarted) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionStarted]);

  const p = contact.properties;
  const phone = phoneOf(contact);
  const callTarget = useMemo(
    () => allo?.target?.name || allo?.target?.email || "Membre Allo",
    [allo?.target?.email, allo?.target?.name],
  );

  return (
    <div className="fixed inset-0 z-[80] bg-white text-[#17231f]">
      <div className="flex h-full flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e7ebe8] px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f3a31] text-white">
              <Phone className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Appel en cours de préparation</div>
              <div className="text-[11px] text-[#7b8781]">Cockpit Gando · {allo?.team?.name || "Allo"}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#68756f] transition hover:bg-[#f1f4f2] hover:text-[#17231f]"
            aria-label="Fermer l’interface d’appel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[340px_1fr_360px]">
          <aside className="border-r border-[#e7ebe8] bg-[#fbfcfb] p-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#e8f0eb] text-[#315444]">
              <UserRound className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.035em]">{fullName(contact)}</h1>
            <div className="mt-1 text-[13px] text-[#6f7b75]">{p.jobtitle || "Fonction à qualifier"}{p.company ? ` · ${p.company}` : ""}</div>

            <div className="mt-7 space-y-5 text-[12px]">
              <div>
                <div className="text-[#89938e]">Téléphone</div>
                <div className="mt-1 text-[14px] font-medium">{phone || "Aucun numéro"}</div>
              </div>
              <div>
                <div className="text-[#89938e]">Heure locale</div>
                <div className="mt-1 text-[14px] font-medium">{p.db_call_local_time || "—"} · {p.db_call_timezone || "Fuseau inconnu"}</div>
              </div>
              <div>
                <div className="text-[#89938e]">Entreprise</div>
                <div className="mt-1 text-[14px] font-medium">{p.company || "—"}</div>
              </div>
              <div>
                <div className="text-[#89938e]">Email</div>
                <div className="mt-1 break-all text-[13px] font-medium">{p.email || "—"}</div>
              </div>
            </div>
          </aside>

          <main className="flex min-h-0 items-center justify-center bg-white p-8">
            <div className="w-full max-w-[620px] text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#edf2ef] text-[#2f4a40]">
                <Phone className="h-8 w-8" strokeWidth={1.7} />
              </div>
              <div className="mt-6 text-[28px] font-semibold tracking-[-0.04em]">{fullName(contact)}</div>
              <div className="mt-2 text-[15px] text-[#6f7a74]">{phone || "Numéro indisponible"}</div>
              <div className="mt-5 font-mono text-[30px] tracking-[-0.03em]">{formatDuration(seconds)}</div>

              <div className="mx-auto mt-7 max-w-[480px] rounded-2xl border border-[#e3e8e5] bg-[#fbfcfb] p-5 text-left">
                <div className="text-[12px] font-semibold">Audio Allo</div>
                <div className="mt-2 text-[12px] leading-5 text-[#718079]">
                  Le prospect est synchronisé dans le Power Dialer de {callTarget}. Cette fenêtre reste le poste de travail commercial dans Gando.
                </div>
                {allo?.directCallReady ? (
                  <div className="mt-3 rounded-lg bg-[#eaf6ee] px-3 py-2 text-[11px] text-[#356849]">Votre clé indique qu’une capacité d’appel direct est disponible. Le branchement de cette action au média Allo peut être fait ici.</div>
                ) : (
                  <div className="mt-3 rounded-lg bg-[#fff8f5] px-3 py-2 text-[11px] leading-5 text-[#87594c]">La clé API actuelle n’expose pas le moteur audio dans le navigateur. L’interface reste dans Gando, mais le média Allo doit encore être lancé par leur client web/app.</div>
                )}
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button
                  className="h-12 rounded-xl bg-[#1f3a31] px-6 text-white hover:bg-[#183129]"
                  onClick={() => setSessionStarted(true)}
                  disabled={sessionStarted}
                >
                  <Phone className="mr-2 h-4 w-4" /> {sessionStarted ? "Session démarrée" : "Démarrer la session"}
                </Button>
                {!allo?.directCallReady ? (
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-[#dfe5e1] bg-white px-5"
                    onClick={() => window.open("https://web.withallo.com", "_blank", "noopener,noreferrer")}
                  >
                    Ouvrir l’audio Allo <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="outline" className="h-12 rounded-xl border-[#ead7d2] bg-white px-5 text-[#9a4e45] hover:bg-[#fff7f5]" onClick={onClose}>
                  <PhoneOff className="mr-2 h-4 w-4" /> Terminer
                </Button>
              </div>
            </div>
          </main>

          <aside className="border-l border-[#e7ebe8] bg-[#fbfcfb] p-6">
            <div className="text-[14px] font-semibold">Notes d’appel</div>
            <div className="mt-1 text-[11px] text-[#7d8882]">À utiliser pendant l’échange sans quitter le dialer.</div>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Objections, besoin, prochain rappel…"
              className="mt-4 min-h-[220px] w-full resize-none rounded-xl border border-[#dfe6e1] bg-white p-3 text-[13px] outline-none transition placeholder:text-[#9ca6a1] focus:border-[#9aaca3]"
            />

            <div className="mt-6 border-t border-[#e5eae7] pt-5">
              <div className="text-[11px] text-[#89938e]">Priorité</div>
              <div className="mt-1 text-[13px] font-medium">{p.db_call_priority_label || `${p.db_call_score || 0}/100`}</div>
              <div className="mt-4 text-[11px] text-[#89938e]">Raison</div>
              <div className="mt-1 text-[12px] leading-5 text-[#5f6d66]">{p.db_call_reason || p.db_call_timing_reason || "Prospect prioritaire pour la session du jour."}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
