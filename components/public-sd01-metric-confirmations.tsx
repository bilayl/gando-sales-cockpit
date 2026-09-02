"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, LockKeyhole, PencilLine } from "lucide-react";
import type { SD01Metric } from "@/lib/sd-room-types";

type Props = {
  token: string;
  metrics: SD01Metric[];
  email: string;
  firstName: string;
  lastName: string;
  language: "fr" | "en";
  locked?: boolean;
  onConfirmed: (index: number, metric: SD01Metric) => void;
};

const tr = (language: "fr" | "en", fr: string, en: string) => language === "en" ? en : fr;

function formatDate(value?: string | null, language: "fr" | "en" = "fr") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export function PublicSD01MetricConfirmations({ token, metrics, email, firstName, lastName, language, locked = false, onConfirmed }: Props) {
  const visible = useMemo(() => metrics.map((metric, index) => ({ metric, index })).filter(item => String(item.metric.lever || "").trim()), [metrics]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [working, setWorking] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  if (!visible.length) return null;

  async function confirm(index: number) {
    const value = String(drafts[index] || "").trim();
    if (!value) {
      setErrors(current => ({ ...current, [index]: tr(language, "Renseignez une valeur.", "Enter a value.") }));
      return;
    }

    setWorking(index);
    setErrors(current => ({ ...current, [index]: "" }));
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/metrics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, metricIndex: index, value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || tr(language, "Confirmation impossible.", "Unable to confirm."));
      onConfirmed(index, payload.metric as SD01Metric);
      setDrafts(current => ({ ...current, [index]: "" }));
    } catch (error) {
      setErrors(current => ({ ...current, [index]: error instanceof Error ? error.message : tr(language, "Confirmation impossible.", "Unable to confirm.") }));
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="rounded-[18px] border border-[#dedaf7] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,30,35,0.025)] sm:px-8 sm:py-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6558c8]">{tr(language, "Collaboration", "Collaboration")}</div>
      <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#172126] sm:text-[23px]">{tr(language, "Métriques à confirmer", "Metrics to confirm")}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#6f787d]">{tr(language, "Vous pouvez compléter uniquement les valeurs laissées à confirmer par Gando. Le reste du document reste en lecture seule.", "You can only complete values explicitly left for confirmation by Gando. The rest of the document remains read-only.")}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visible.map(({ metric, index }) => {
          const confirmed = Boolean(String(metric.value || "").trim());
          return (
            <div key={`${metric.lever}-${index}`} className={`rounded-2xl border p-4 ${confirmed ? "border-[#d8e8dc] bg-[#f4faf5]" : "border-[#dedaf7] bg-[#f8f7ff]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6558c8]">{metric.lever}</div>
                  {metric.mechanism ? <p className="mt-1 text-[12px] leading-5 text-[#6f6a85]">{metric.mechanism}</p> : null}
                </div>
                {confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#3f7450] ring-1 ring-[#d8e8dc]"><Check className="h-3 w-3" />{tr(language, "Confirmée", "Confirmed")}</span> : locked ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#747d82] ring-1 ring-[#d9dde0]"><LockKeyhole className="h-3 w-3" />{tr(language, "Verrouillée", "Locked")}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#6558c8] ring-1 ring-[#dedaf7]"><PencilLine className="h-3 w-3" />{tr(language, "À compléter", "To complete")}</span>}
              </div>

              {confirmed ? (
                <div className="mt-4">
                  <div className="text-[25px] font-semibold tracking-[-0.03em] text-[#385f45]">{metric.value}</div>
                  {(metric.confirmedBy || metric.confirmedAt) ? <div className="mt-2 text-[10px] text-[#738079]">{tr(language, "Confirmée par", "Confirmed by")} {metric.confirmedBy || metric.confirmedEmail}{metric.confirmedAt ? ` · ${formatDate(metric.confirmedAt, language)}` : ""}</div> : null}
                </div>
              ) : locked ? (
                <p className="mt-4 text-[13px] italic text-[#81898e]">{tr(language, "Valeur non renseignée avant validation du SD01.", "Value was not entered before SD01 approval.")}</p>
              ) : (
                <div className="mt-4">
                  <input
                    value={drafts[index] || ""}
                    onChange={event => setDrafts(current => ({ ...current, [index]: event.target.value }))}
                    placeholder={tr(language, "Ex. 12 000 cautions / an", "e.g. 12,000 deposits / year")}
                    className="h-11 w-full rounded-xl border border-[#d5d0f0] bg-white px-3.5 text-[14px] text-[#202a2f] outline-none placeholder:text-[#9b98ad] focus:border-[#776bd0] focus:ring-2 focus:ring-[#776bd0]/10"
                  />
                  {errors[index] ? <p className="mt-2 text-[11px] text-[#a64b43]">{errors[index]}</p> : null}
                  <button type="button" onClick={() => void confirm(index)} disabled={working === index} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#202a2f] px-3.5 text-[12px] font-semibold text-white disabled:opacity-50">
                    {working === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {tr(language, "Confirmer cette valeur", "Confirm this value")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
