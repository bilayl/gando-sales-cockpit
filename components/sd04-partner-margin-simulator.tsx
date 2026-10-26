"use client";

import { useEffect, useState } from "react";

type Props = {
  averageDeposit: number;
  partnerMarginRate: number;
  monthlyActivations: number;
  compact?: boolean;
  language?: "fr" | "en";
};

const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 2500;
const DEFAULT_DEPOSIT = 1300;
const clampDeposit = (amount: number) => Number.isFinite(amount)
  ? Math.min(MAX_DEPOSIT, Math.max(MIN_DEPOSIT, amount))
  : DEFAULT_DEPOSIT;

function euro(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

/** Interactive, client-side illustration. This changes no agreed commercial rate or stored SD04 data. */
export function SD04PartnerMarginSimulator({ averageDeposit, partnerMarginRate, monthlyActivations, compact = false, language = "fr" }: Props) {
  const t = (fr: string, en: string) => language === "en" ? en : fr;
  const initialDeposit = clampDeposit(averageDeposit > 0 ? averageDeposit : DEFAULT_DEPOSIT);
  const [deposit, setDeposit] = useState(initialDeposit);
  useEffect(() => { setDeposit(initialDeposit); }, [initialDeposit]);

  const rate = Math.max(0, Number.isFinite(partnerMarginRate) ? partnerMarginRate : 0);
  const volume = Math.max(0, Number.isFinite(monthlyActivations) ? monthlyActivations : 0);
  const perDeposit = deposit * rate / 100;
  const monthly = perDeposit * volume;
  const annual = monthly * 12;

  return <div className="mt-7 border-t border-[#eceeef] pt-6">
    <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{t("Exemple de revenu partenaire", "Partner revenue example")}</div>
    <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#687277]">
      {t("Une illustration concrète de ce que la marge partenaire peut représenter. Cette projection dépend du volume réel de cautions activées. Tous les revenus indiqués sont hors taxes (HT).", "A concrete illustration of the partner's margin. Projections depend on actual activated deposit volume. All revenue is shown excluding VAT.")}
    </p>

    <div className="mt-5 rounded-[16px] border border-[#dedcf0] bg-[#fbfaff] px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="sd04-deposit-simulation" className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#7166c7]">{t("Montant de la caution à simuler", "Deposit amount to simulate")}</label>
          <p className="mt-1 text-[13px] leading-5 text-[#717783]">{t("Déplacez le curseur pour voir la marge gagnée à chaque caution.", "Move the slider to see the margin earned on each deposit.")}</p>
        </div>
        <output htmlFor="sd04-deposit-simulation" className="rounded-xl border border-[#e0dcf5] bg-white px-4 py-2 text-[22px] font-semibold tracking-tight text-[#211f32]" aria-live="off">{euro(deposit)}</output>
      </div>
      <input
        id="sd04-deposit-simulation"
        aria-label={t("Montant de caution simulé en euros", "Simulated deposit amount in euros")}
        type="range"
        min={MIN_DEPOSIT}
        max={MAX_DEPOSIT}
        step={10}
        value={deposit}
        onChange={event => setDeposit(clampDeposit(Number(event.target.value)))}
        className="mt-5 h-3 w-full cursor-pointer accent-[#7166c7]"
      />
      <div className="mt-2 flex items-center justify-between text-[12px] font-semibold text-[#798087]">
        <span>{euro(MIN_DEPOSIT)}</span>
        <span>{euro(MAX_DEPOSIT)}</span>
      </div>
      <div className="mt-3 text-[12px] text-[#797486]">
        {t("Marge partenaire prévue dans cette proposition :", "Partner margin agreed in this proposal:")} <strong className="text-[#6356b0]">{rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % HT</strong>
        {" · "}{t("Simulation indicative et non contractuelle.", "Illustrative, non-binding simulation.")}
      </div>
    </div>

    <div className={compact ? "mt-5 grid gap-3 sm:grid-cols-2" : "mt-5 grid gap-3 sm:grid-cols-3"}>
      <div className="rounded-[16px] border border-[#e0e4e6] bg-[#f8f9f9] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#687277]">{t("Par caution · HT", "Per deposit · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{euro(perDeposit)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{euro(deposit)} × {rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</div>
      </div>
      <div className="rounded-[16px] border border-[#dedcf0] bg-[#f8f7ff] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{t("Revenu estimé / mois · HT", "Estimated monthly revenue · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#6257b8]">{euro(monthly)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{volume.toLocaleString("fr-FR")} {t("cautions activées / mois", "activated deposits / month")}</div>
      </div>
      <div className="rounded-[16px] border border-[#e0e4e6] bg-[#f8f9f9] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#687277]">{t("Projection annuelle · HT", "Annual projection · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{euro(annual)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{t("à volume mensuel constant", "at constant monthly volume")}</div>
      </div>
    </div>
    <div className="mt-4 rounded-xl bg-[#f8f9f9] px-4 py-3.5 text-[15px] leading-7 text-[#59646a]">
      {t("Exemple : avec une caution moyenne de", "Example: with an average deposit of")} <strong className="text-[#1c2529]">{euro(deposit)}</strong> {t("et une marge partenaire de", "and a partner margin of")} <strong className="text-[#1c2529]">{rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</strong>, {t("chaque caution activée génère", "each activated deposit generates")} <strong className="text-[#1c2529]">{euro(perDeposit)} HT</strong>. {t("À", "At")} <strong className="text-[#1c2529]">{volume.toLocaleString("fr-FR")} {t("cautions/mois", "deposits/month")}</strong>, {t("cela représente environ", "this represents approximately")} <strong className="text-[#6257b8]">{euro(monthly)} HT/{t("mois", "month")}</strong>.
    </div>
  </div>;
}
