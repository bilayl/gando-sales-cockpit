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
  companyName?: string;
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

  return <section className="overflow-hidden rounded-[18px] border border-[#d9d4f7] bg-white shadow-[0_1px_2px_rgba(20,30,35,0.025)]">
    <div className="px-5 py-6 sm:px-8 sm:py-7">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6558c8]">{tr(language, "Données du projet", "Project data")}</div>
      <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#172126] sm:text-[23px]">{tr(language, "Métriques", "Metrics")}</h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#6f787d]">{tr(language, "Les métriques sont des données factuelles du client. Lorsqu’une valeur manque, l’interlocuteur peut la confirmer directement dans le document.", "Metrics are factual client data. When a value is missing, the stakeholder can confirm it directly in the document.")}</p>
    </div>

    <div className="overflow-x-auto border-t border-[#e7e4f6]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="bg-[#f5f3ff] text-[11px] font-semibold text-[#6558c8]">
            <th className="w-[25%] border-r border-[#ddd9f3] px-5 py-3.5">{tr(language, "Métrique", "Metric")}</th>
            <th className="w-[34%] border-r border-[#ddd9f3] px-5 py-3.5">{tr(language, "Contexte", "Context")}</th>
            <th className="px-5 py-3.5">{tr(language, "Valeur", "Value")}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ metric, index }) => {
            const confirmed = Boolean(String(metric.value || "").trim());
            return <tr key={`${metric.lever}-${index}`} className="border-t border-[#e4e6e8] align-top text-[14px] text-[#384247]">
              <td className="border-r border-[#e4e6e8] px-5 py-4 font-semibold text-[#202a2f]">{metric.lever}</td>
              <td className="border-r border-[#e4e6e8] px-5 py-4 leading-6">{metric.mechanism || <span className="italic text-[#8a9296]">{tr(language, "À préciser", "To define")}</span>}</td>
              <td className="px-5 py-4">
                {confirmed ? <div>
                  <div className="flex items-center gap-2"><span className="text-[16px] font-semibold text-[#385f45]">{metric.value}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#eef7f0] px-2 py-1 text-[10px] font-semibold text-[#3f7450]"><Check className="h-3 w-3" />{tr(language, "Confirmée", "Confirmed")}</span></div>
                  {(metric.confirmedBy || metric.confirmedAt) ? <div className="mt-2 text-[10px] text-[#738079]">{tr(language, "Confirmée par", "Confirmed by")} {metric.confirmedBy || metric.confirmedEmail}{metric.confirmedAt ? ` · ${formatDate(metric.confirmedAt, language)}` : ""}</div> : null}
                </div> : locked ? <div className="flex items-center gap-2 text-[12px] italic text-[#81898e]"><LockKeyhole className="h-3.5 w-3.5" />{tr(language, "Valeur non renseignée", "Value not entered")}</div> : <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#6558c8]"><PencilLine className="h-3.5 w-3.5" />{tr(language, "À confirmer", "To confirm")}</div>
                  <div className="mt-2 flex gap-2">
                    <input value={drafts[index] || ""} onChange={event => setDrafts(current => ({ ...current, [index]: event.target.value }))} placeholder={tr(language, "Ex. 100 à 150 contrats / mois", "e.g. 100 to 150 contracts / month")} className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5d0f0] bg-white px-3 text-[13px] text-[#202a2f] outline-none placeholder:text-[#9b98ad] focus:border-[#776bd0] focus:ring-2 focus:ring-[#776bd0]/10" />
                    <button type="button" onClick={() => void confirm(index)} disabled={working === index} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#202a2f] px-3 text-[11px] font-semibold text-white disabled:opacity-50">{working === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{tr(language, "Confirmer", "Confirm")}</button>
                  </div>
                  {errors[index] ? <p className="mt-2 text-[11px] text-[#a64b43]">{errors[index]}</p> : null}
                </div>}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
