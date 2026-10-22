"use client";

import { useState } from "react";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import type { SD01Metric } from "@/lib/sd-room-types";

type Props = {
  token: string;
  metrics: SD01Metric[];
  firstName: string;
  lastName: string;
  email: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onConfirmed: (index: number, metric: SD01Metric) => void;
};

export function PublicQuickDealMetrics({
  token, metrics, firstName, lastName, email,
  onFirstNameChange, onLastNameChange, onEmailChange, onConfirmed,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [working, setWorking] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const visible = metrics.map((metric, index) => ({ metric, index })).filter(item => item.metric.lever?.trim());
  const confirmedCount = visible.filter(item => Boolean(item.metric.confirmedAt)).length;

  if (!visible.length) return null;

  async function confirm(index: number, metric: SD01Metric) {
    const value = String(drafts[index] ?? metric.value ?? "").trim();
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors(current => ({ ...current, [index]: "Renseignez votre prénom, votre nom et un email valide ci-dessus." }));
      return;
    }
    if (!value) {
      setErrors(current => ({ ...current, [index]: "Renseignez une valeur avant de la confirmer." }));
      return;
    }
    setWorking(index);
    setErrors(current => ({ ...current, [index]: "" }));
    try {
      const response = await fetch(`/api/public/deal-room/${encodeURIComponent(token)}/metrics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentCode: "SD04", metricIndex: index, value, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Confirmation impossible.");
      onConfirmed(index, payload.metric as SD01Metric);
      setDrafts(current => { const next = { ...current }; delete next[index]; return next; });
    } catch (error) {
      setErrors(current => ({ ...current, [index]: error instanceof Error ? error.message : "Confirmation impossible." }));
    } finally {
      setWorking(null);
    }
  }

  return <section className="mt-6 overflow-hidden rounded-[20px] border border-[#dad5f4] bg-white shadow-sm">
    <div className="border-b border-[#e7e4f6] bg-[#f9f8ff] px-5 py-6 sm:px-8">
      <div className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#675bc3]">Facultatif · Données du projet</div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[23px] font-semibold tracking-[-0.025em] text-[#202a2f]">Métriques à confirmer</h2>
        <span className="rounded-full border border-[#d7d0f4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6257b8]">{confirmedCount} / {visible.length} confirmées</span>
      </div>
      <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#687277]">Quelques informations pour dimensionner le projet Gando. Vous pouvez renseigner les données que vous connaissez, maintenant ou plus tard. Cette étape ne conditionne pas votre accord commercial.</p>
      {confirmedCount < visible.length ? <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <input aria-label="Prénom" value={firstName} onChange={event => onFirstNameChange(event.target.value)} placeholder="Prénom" className="h-11 min-w-0 rounded-xl border border-[#d7d3e8] bg-white px-3.5 text-[14px] outline-none focus:border-[#776bd0]" />
        <input aria-label="Nom" value={lastName} onChange={event => onLastNameChange(event.target.value)} placeholder="Nom" className="h-11 min-w-0 rounded-xl border border-[#d7d3e8] bg-white px-3.5 text-[14px] outline-none focus:border-[#776bd0]" />
        <input aria-label="Email professionnel" type="email" value={email} onChange={event => onEmailChange(event.target.value)} placeholder="Email professionnel" className="h-11 min-w-0 rounded-xl border border-[#d7d3e8] bg-white px-3.5 text-[14px] outline-none focus:border-[#776bd0]" />
      </div> : null}
    </div>
    <div className="divide-y divide-[#edf0f2]">
      {visible.map(({ metric, index }) => <div key={index} className="grid gap-3 px-5 py-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6">
        <div>
          <div className="text-[15px] font-semibold text-[#202a2f]">{metric.lever}</div>
          {metric.mechanism ? <p className="mt-1 text-[13px] leading-6 text-[#687277]">{metric.mechanism}</p> : null}
        </div>
        {metric.confirmedAt ? <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[17px] font-semibold text-[#385f45]">{metric.value}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#eaf6ed] px-2.5 py-1 text-[11px] font-semibold text-[#3f7450]"><CheckCircle2 className="h-3.5 w-3.5" />Confirmée</span></div>
          <p className="mt-1 text-[11px] leading-5 text-[#738079]">Confirmée par {metric.confirmedBy || metric.confirmedEmail || "le client"}{metric.confirmedAt ? ` · ${new Date(metric.confirmedAt).toLocaleDateString("fr-FR")}` : ""}</p>
        </div> : <div>
          <div className="text-[12px] font-semibold text-[#7866bc]">À confirmer</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input aria-label={`Valeur de ${metric.lever}`} value={drafts[index] ?? metric.value ?? ""} onChange={event => setDrafts(current => ({ ...current, [index]: event.target.value }))} placeholder="Votre valeur" className="h-11 min-w-0 flex-1 rounded-xl border border-[#d7d3e8] bg-white px-3.5 text-[14px] outline-none focus:border-[#776bd0]" />
            <button type="button" disabled={working !== null} onClick={() => void confirm(index, metric)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#202a2f] px-4 text-[13px] font-semibold text-white disabled:opacity-50">{working === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirmer</button>
          </div>
          {errors[index] ? <p className="mt-2 text-[12px] text-[#a64b43]">{errors[index]}</p> : null}
        </div>}
      </div>)}
    </div>
  </section>;
}
