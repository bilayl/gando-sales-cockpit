import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySD04 } from "../lib/sd-stage-content.ts";
import { computeQuickDealEconomics, quickPricingRows } from "../lib/quick-deal-economics.ts";

test("Sépare volume de cautions, CA Gando et marge loueur", () => {
  const model = createEmptySD04().gandoEconomics;
  const result = computeQuickDealEconomics(model);
  assert.equal(result.securedMonthly, 30_000);
  assert.equal(result.monthlyGandoRevenue, 750);
  assert.equal(result.annualGandoRevenue, 9_000);
  assert.equal(result.monthlyPartnerRevenue, 210);
  assert.equal(result.monthlyInsuranceCost, 342);
  assert.equal(result.monthlyPaymentCost, 25.86);
  assert.equal(result.monthlyContribution, 382.14);
  assert.equal(result.customerPricePercent, 3.2);
});

test("Intègre abonnement et commissions sur encaissements dans le CA Gando", () => {
  const model = {
    ...createEmptySD04().gandoEconomics,
    monthlySubscription: 50,
    expectedCollectionSharePercent: 10,
  };
  const result = computeQuickDealEconomics(model);
  assert.equal(result.collectionEvents, 3);
  assert.equal(result.collectionRevenue, 81);
  assert.equal(result.monthlyGandoRevenue, 881);
  assert.equal(result.monthlyContribution, 513.14);
});

test("Les lignes de prix sont calculées depuis la grille Gando", () => {
  const model = { ...createEmptySD04().gandoEconomics, gandoRatePercent: 3, partnerMarginPercent: 1 };
  const pricing = quickPricingRows(model);
  assert.equal(pricing[0].price, "3 % HT");
  assert.equal(pricing[1].price, "+1 % HT");
  assert.equal(pricing[2].price, "4 % HT");
});

test("Les commissions d'encaissement portent sur un montant moyen prévu", () => {
  const model = { ...createEmptySD04().gandoEconomics,
    expectedCollectionSharePercent: 10, averageCollectionAmountPercent: 40 };
  const result = computeQuickDealEconomics(model);
  assert.equal(result.collectionEvents, 3);
  assert.equal(result.collectionRevenue, 36);
});
