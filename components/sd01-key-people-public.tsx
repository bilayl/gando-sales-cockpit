import { Mail, UserRound } from "lucide-react";
import type { SD01Content } from "@/lib/sd-room-types";

type Stakeholder = SD01Content["stakeholders"][number];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "?";
}

export function SD01KeyPeoplePublic({ stakeholders, language = "fr" }: { stakeholders: Stakeholder[]; language?: "fr" | "en" }) {
  const people = (stakeholders || []).filter(person => person.name || person.role || person.organization || person.notes);
  if (!people.length) return null;

  return <section className="rounded-[22px] border border-[#e2e7e4] bg-white px-5 py-5 shadow-[0_10px_35px_rgba(20,35,28,0.035)] sm:px-7 sm:py-6">
    <div className="flex items-end justify-between gap-4 border-b border-[#edf0ee] pb-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#735DF3]">{language === "en" ? "Stakeholders & decision-makers" : "Interlocuteurs & décideurs"}</div>
        <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#18221e]">{language === "en" ? "Key people" : "Personnes clés"}</h2>
      </div>
      <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-[#7b8781] sm:flex"><UserRound className="h-3.5 w-3.5" /> {people.length} {language === "en" ? `person${people.length > 1 ? "s" : ""}` : `personne${people.length > 1 ? "s" : ""}`}</div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {people.map((person, index) => <article key={`${person.name}-${person.role}-${index}`} className="rounded-2xl border border-[#e8ecea] bg-[#fafbfa] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#735DF3] text-xs font-black tracking-[0.04em] text-white shadow-sm">{initials(person.name || person.role || "")}</div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[#18221e]">{person.name || (language === "en" ? "Stakeholder to confirm" : "Interlocuteur à confirmer")}</h3>
            {person.role ? <p className="mt-0.5 text-xs font-semibold text-[#4d5b55]">{person.role}</p> : null}
            {person.organization ? <p className="mt-0.5 truncate text-[11px] text-[#7b8781]">{person.organization}</p> : null}
          </div>
        </div>
        {person.notes ? <div className="mt-3 rounded-xl border border-[#ecefed] bg-white px-3 py-2 text-[11px] leading-5 text-[#65716c]">{person.notes}</div> : null}
        {"email" in person && typeof person.email === "string" && person.email ? <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[#65716c]"><Mail className="h-3 w-3" /> {person.email}</div> : null}
      </article>)}
    </div>
  </section>;
}
