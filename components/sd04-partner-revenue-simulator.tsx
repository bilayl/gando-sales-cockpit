"use client";

import { useEffect, useState } from "react";

type Props = {
  averageDeposit: number;
  monthlyActivations: number;
  partnerMarginRate: number;
  compact?: boolean;
  language?: "fr" | "en";
};

const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 2500;
const MAX_MONTHLY_VOLUME = 100000;

function validNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clampDeposit(value: number) {
  return Math.min(MAX_DEPOSIT, Math.max(MIN_DEPOSIT, Math.round(validNumber(value, 1300))));
}

function clampMonthlyVolume(value: number) {
  return Math.min(MAX_MONTHLY_VOLUME, Math.max(0, Math.round(validNumber(value, 30))));
}

const formatMoney = (value: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const formatVolume = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);

/**
 * Public/read-only simulation: changes affect the visitor's local view only.
 * The quoted partner rate, published monthly baseline and accepted contract
 * are never updated by moving these sliders.
 */
export function SD04PartnerRevenueSimulator({
  averageDeposit, monthlyActivations, partnerMarginRate, compact = false, language = "fr",
}: Props) {
  const t = (fr: string, en: string) => language === "en" ? en : fr;
  const [deposit, setDeposit] = useState(() => clampDeposit(averageDeposit));
  const [volume, setVolume] = useState(() => clampMonthlyVolume(monthlyActivations));

  useEffect(() => { setDeposit(clampDeposit(averageDeposit)); }, [averageDeposit]);
  useEffect(() => { setVolume(clampMonthlyVolume(monthlyActivations)); }, [monthlyActivations]);

  const margin = Math.max(0, Math.min(100, validNumber(partnerMarginRate, 0)));
  const revenuePerDeposit = deposit * margin / 100;
  const monthlyRevenue = revenuePerDeposit * volume;
  const yearlyRevenue = monthlyRevenue * 12;
  const monthlySecured = deposit * volume;
  const volumeSliderMax = Math.max(200, Math.ceil(volume / 100) * 100);

  return <section className="mt-7 border-t border-[#eceeef] pt-6">
    <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#687277]">{t("Exemple de revenu partenaire", "Partner revenue example")}</div>
    <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#687277]">
      {t(
        "Une illustration concrète de ce que la marge partenaire peut représenter. Cette projection dépend du volume réel de cautions activées. Tous les revenus indiqués sont hors taxes (HT).",
        "An illustration of the partner margin. This projection depends on the actual volume of activated deposits. All revenue is shown excluding VAT.",
      )}
    </p>

    <div className="mt-5 rounded-[16px] border border-[#dedcf0] bg-[#fbfaff] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{t("Simulateur de marge", "Margin simulator")}</div>
          <p className="mt-1 text-[13px] leading-5 text-[#687277]">{t("Modifiez la caution et le volume mensuel pour voir votre revenu potentiel.", "Adjust the deposit and monthly volume to see your potential revenue.")}</p>
        </div>
        <span className="rounded-full border border-[#dedcf0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6b60af]">{t("Marge partenaire", "Partner margin")} : {margin.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="sd04-deposit-amount" className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold text-[#30343f]">
            {t("Montant de la caution", "Deposit amount")}
            <span className="text-[19px] font-semibold tracking-tight text-[#6257b8]">{formatMoney(deposit)}</span>
          </label>
          <input id="sd04-deposit-amount" type="range" min={MIN_DEPOSIT} max={MAX_DEPOSIT} step={50} value={deposit}
            aria-label={t("Montant de la caution", "Deposit amount")}
            onChange={event => setDeposit(clampDeposit(Number(event.target.value)))}
            className="mt-4 h-2 w-full cursor-pointer accent-[#7166c7]" />
          <div className="mt-1 flex justify-between text-[12px] text-[#81898e]"><span>100 €</span><span>2 500 €</span></div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-[#687277]">{t("Ou saisir le montant", "Or enter an amount")}
            <input type="number" min={MIN_DEPOSIT} max={MAX_DEPOSIT} step={50} value={deposit}
              aria-label={t("Montant de caution en euros", "Deposit amount in euros")}
              onChange={event => { if (event.target.value !== "") setDeposit(clampDeposit(Number(event.target.value))); }}
              className="h-9 w-28 rounded-lg border border-[#d6d3e6] bg-white px-2.5 text-right text-[13px] font-semibold text-[#30343f] outline-none focus:border-[#7166c7]" />
            <span>€</span>
          </label>
        </div>

        <div>
          <label htmlFor="sd04-monthly-volume" className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold text-[#30343f]">
            {t("Volume d’engagement mensuel", "Monthly commitment volume")}
            <span className="text-[19px] font-semibold tracking-tight text-[#6257b8]">{formatVolume(volume)} {t("cautions", "deposits")}</span>
          </label>
          <input id="sd04-monthly-volume" type="range" min={0} max={volumeSliderMax} step={1} value={volume}
            aria-label={t("Nombre de cautions par mois", "Number of deposits per month")}
            onChange={event => setVolume(clampMonthlyVolume(Number(event.target.value)))}
            className="mt-4 h-2 w-full cursor-pointer accent-[#7166c7]" />
          <div className="mt-1 flex justify-between text-[12px] text-[#81898e]"><span>0</span><span>{formatVolume(volumeSliderMax)} {t("cautions/mois", "deposits/month")}</span></div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-[#687277]">{t("Ou saisir le volume", "Or enter the volume")}
            <input type="number" min={0} max={MAX_MONTHLY_VOLUME} step={1} value={volume}
              aria-label={t("Nombre de cautions activées chaque mois", "Monthly activated deposits")}
              onChange={event => { if (event.target.value !== "") setVolume(clampMonthlyVolume(Number(event.target.value))); }}
              className="h-9 w-28 rounded-lg border border-[#d6d3e6] bg-white px-2.5 text-right text-[13px] font-semibold text-[#30343f] outline-none focus:border-[#7166c7]" />
            <span>{t("/ mois", "/ month")}</span>
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e3f2] pt-4">
        <div className="text-[12px] text-[#687277]">{t("Volume de cautions sécurisées / mois", "Value of deposits secured / month")}</div>
        <div className="text-[16px] font-semibold text-[#353044]">{formatMoney(monthlySecured)}</div>
      </div>
    </div>

    <div className={compact ? "mt-5 grid gap-3 sm:grid-cols-2" : "mt-5 grid gap-3 sm:grid-cols-3"}>
      <div className="rounded-[16px] border border-[#e0e4e6] bg-[#f8f9f9] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#687277]">{t("Par caution · HT", "Per deposit · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{formatMoney(revenuePerDeposit)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{formatMoney(deposit)} × {margin.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</div>
      </div>
      <div className="rounded-[16px] border border-[#dedcf0] bg-[#f8f7ff] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#7166c7]">{t("Revenu estimé / mois · HT", "Estimated revenue / month · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#6257b8]">{formatMoney(monthlyRevenue)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{formatVolume(volume)} {t("cautions activées / mois", "activated deposits / month")}</div>
      </div>
      <div className="rounded-[16px] border border-[#e0e4e6] bg-[#f8f9f9] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#687277]">{t("Projection annuelle · HT", "Annual projection · excl. VAT")}</div>
        <div className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-[#211f32]">{formatMoney(yearlyRevenue)} HT</div>
        <div className="mt-1 text-[13px] leading-5 text-[#687277]">{t("à volume mensuel constant", "at constant monthly volume")}</div>
      </div>
    </div>

    <p className="mt-4 rounded-xl bg-[#f8f9f9] px-4 py-3.5 text-[15px] leading-7 text-[#59646a]">
      {t("Exemple : avec une caution moyenne de", "Example: with an average deposit of")} <strong className="text-[#1c2529]">{formatMoney(deposit)}</strong> {t("et une marge partenaire de", "and a partner margin of")} <strong className="text-[#1c2529]">{margin.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</strong>, {t("chaque caution activée génère", "each activated deposit generates")} <strong className="text-[#1c2529]">{formatMoney(revenuePerDeposit)} HT</strong>. {t("À", "At")} <strong className="text-[#1c2529]">{formatVolume(volume)} {t("cautions/mois", "deposits/month")}</strong>, {t("cela représente environ", "this represents approximately")} <strong className="text-[#6257b8]">{formatMoney(monthlyRevenue)} HT/{t("mois", "month")}</strong>.
    </p>
    <p className="mt-2 text-[11px] leading-5 text-[#868b92]">{t("Simulation indicative : les curseurs ne modifient pas les tarifs de la proposition ni un éventuel engagement contractuel. Le volume réel dépend des cautions activées.", "Illustrative simulation: the sliders do not change quoted rates or any contractual commitment. Actual revenue depends on activated deposits.")}</p>
  </section>;
}
