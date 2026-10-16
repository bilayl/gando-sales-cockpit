import type { SD04Content } from "@/lib/sd-stage-content";

export type GandoEconomics = SD04Content["gandoEconomics"];

export function computeQuickDealEconomics(value: GandoEconomics) {
  const volume = Math.max(0, value.monthlyActivations);
  const deposit = Math.max(0, value.averageDeposit);
  const securedMonthly = deposit * volume;
  const gandoPerDeposit = deposit * value.gandoRatePercent / 100;
  const partnerPerDeposit = deposit * value.partnerMarginPercent / 100;
  const collectionEvents = volume * value.expectedCollectionSharePercent / 100;
  const collectionRevenue = collectionEvents * (deposit * value.collectionRatePercent / 100 + value.collectionFixedFee);
  const monthlyGandoRevenue = volume * gandoPerDeposit + value.monthlySubscription + collectionRevenue;
  const monthlyPartnerRevenue = volume * partnerPerDeposit;
  // Payment rate is applied only to the charged Gando fee, not to the caution amount.
  const monthlyInsuranceCost = securedMonthly * value.insuranceCostPercent / 100;
  const monthlyPaymentCost = volume * (gandoPerDeposit * value.paymentCostPercent / 100 + value.paymentFixedCost);
  const monthlyContribution = monthlyGandoRevenue - monthlyInsuranceCost - monthlyPaymentCost;
  return {
    securedMonthly,
    gandoPerDeposit,
    partnerPerDeposit,
    collectionEvents,
    collectionRevenue,
    monthlyGandoRevenue,
    annualGandoRevenue: monthlyGandoRevenue * 12,
    monthlyPartnerRevenue,
    monthlyInsuranceCost,
    monthlyPaymentCost,
    monthlyContribution,
    annualContribution: monthlyContribution * 12,
    customerPricePercent: value.gandoRatePercent + value.partnerMarginPercent,
  };
}

export const QUICK_PRICING_KEYS = [
  "tarif gando",
  "marge partenaire",
  "tarif total client",
  "frais d’encaissement",
  "frais d'encaissement",
] as const;

export function isQuickPricingRow(item: string) {
  return QUICK_PRICING_KEYS.includes(item.trim().toLowerCase() as (typeof QUICK_PRICING_KEYS)[number]);
}

export function quickPricingRows(value: GandoEconomics): SD04Content["pricing"] {
  const f = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return [
    { item: "Tarif Gando", model: "commission", price: f(value.gandoRatePercent) + " % HT", notes: "par caution activée" },
    { item: "Marge partenaire", model: "commission", price: "+" + f(value.partnerMarginPercent) + " % HT", notes: "conservée par le loueur" },
    { item: "Tarif total client", model: "commission", price: f(value.gandoRatePercent + value.partnerMarginPercent) + " % HT", notes: "sécurisation de la caution" },
    { item: "Frais d’encaissement", model: "condition", price: f(value.collectionRatePercent) + " % + " + f(value.collectionFixedFee) + " € HT", notes: "uniquement en cas d’encaissement" },
  ];
}
