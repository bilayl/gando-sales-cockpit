import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type MirrorRow = { source_id: string; payload: Row };
type Account = {
  id: string;
  name: string;
  customRatePercent: number | null;
};
type Deposit = {
  id: string;
  clientId: string;
  accountId: string;
  status: string;
  amountCents: number;
  createdAt: number | null;
  updatedAt: number | null;
  archived: boolean;
};
type Fee = {
  id: string;
  clientId: string;
  amountCents: number;
  createdAt: number | null;
};
type Tier = { min_cents?: number; max_cents?: number; reward_cents?: number };

const PSP_RATE = 0.016;
const PSP_FIXED_EUR = 0.35;
const DEFAULT_INSURANCE_RATE_BPS = 114;
const MATCH_WINDOW_MS = 14 * 86400000;
const LIVE_WINDOW_MS = 30 * 86400000;
const SUCCESSFUL = new Set(["active", "close", "captured"]);

const STAGE_PROBABILITY: Record<string, number> = {
  SD01: 0.15,
  SD02: 0.3,
  SD03: 0.5,
  SD04: 0.75,
  SD05: 0.9,
  LIVE: 1,
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return value === true || value === "true";
}

function ts(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function probabilityFor(stage: string, status: string) {
  if (stage === "LIVE" || status === "signed" || status === "won") return 1;
  return STAGE_PROBABILITY[stage] ?? 0.1;
}

function parsePercent(value: unknown) {
  const match = text(value).match(/(\d+(?:[.,]\d+)?)\s*%/);
  return match ? n(match[1].replace(",", ".")) : 0;
}

function parseEuro(value: unknown) {
  const source = text(value).replace(/\s/g, "");
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*€/);
  return match ? n(match[1].replace(",", ".")) : 0;
}

function canonicalName(value: unknown) {
  const normalized = text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(token => token && !["gando", "location", "locations", "loc", "x", "sas", "sarl"].includes(token))
    .join(" ")
    .trim();
  return normalized || text(value).toLowerCase().trim();
}

function namesMatch(left: string, right: string) {
  const a = canonicalName(left);
  const b = canonicalName(right);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
}

function reward(amountCents: number, tiers: Tier[]) {
  const tier = tiers.find(candidate => {
    const min = n(candidate.min_cents);
    const max = candidate.max_cents == null ? Number.POSITIVE_INFINITY : n(candidate.max_cents);
    return amountCents >= min && amountCents <= max;
  });
  return tier ? n(tier.reward_cents) : 0;
}

function buildAccounts(rows: MirrorRow[]): Account[] {
  return rows
    .map(row => {
      const name = text(row.payload.display_name) || text(row.payload.company_name);
      const customRate = n(row.payload.custom_securing_fee_rate);
      return {
        id: row.source_id,
        name,
        customRatePercent: customRate > 0 ? customRate * 100 : null,
      };
    })
    .filter(row => row.name);
}

function buildDeposits(rows: MirrorRow[]): Deposit[] {
  return rows.map(row => ({
    id: row.source_id,
    clientId: text(row.payload.client_id),
    accountId: text(row.payload.account_id),
    status: text(row.payload.status),
    amountCents: n(row.payload.amount_cents),
    createdAt: ts(row.payload.created_at),
    updatedAt: ts(row.payload.updated_at),
    archived: bool(row.payload.is_archived),
  }));
}

function buildFees(rows: MirrorRow[]): Fee[] {
  return rows
    .filter(row => text(row.payload.type) === "fee")
    .map(row => ({
      id: row.source_id,
      clientId: text(row.payload.client_id),
      amountCents: n(row.payload.amount),
      createdAt: ts(row.payload.created_at),
    }))
    .filter(row => row.clientId && row.amountCents > 0 && row.createdAt != null);
}

function matchFees(deposits: Deposit[], fees: Fee[]) {
  const byClient = new Map<string, Deposit[]>();
  for (const deposit of deposits) {
    if (deposit.archived || !deposit.clientId || !SUCCESSFUL.has(deposit.status)) continue;
    const list = byClient.get(deposit.clientId) || [];
    list.push(deposit);
    byClient.set(deposit.clientId, list);
  }

  const used = new Set<string>();
  const matches: Array<{ deposit: Deposit; fee: Fee }> = [];
  for (const fee of [...fees].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
    if (fee.createdAt == null) continue;
    const best = (byClient.get(fee.clientId) || [])
      .filter(deposit => !used.has(deposit.id))
      .map(deposit => {
        const dates = [deposit.createdAt, deposit.updatedAt].filter((value): value is number => value != null);
        const gap = dates.length
          ? Math.min(...dates.map(value => Math.abs(fee.createdAt! - value)))
          : Number.POSITIVE_INFINITY;
        return { deposit, gap };
      })
      .filter(item => item.gap <= MATCH_WINDOW_MS)
      .sort((a, b) => a.gap - b.gap)[0];
    if (!best) continue;
    used.add(best.deposit.id);
    matches.push({ deposit: best.deposit, fee });
  }
  return matches;
}

async function readMirror(table: string): Promise<MirrorRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("gando_source_records")
    .select("source_id,payload")
    .eq("source_table", table)
    .order("source_id", { ascending: true });
  if (error) throw error;
  return (data || []) as MirrorRow[];
}

function proposalFromDocuments(
  room: Row,
  documents: Array<{ code: string; status: string; content: Row | null; published_content: Row | null }>,
) {
  const byCode = new Map(documents.map(doc => [doc.code, doc]));
  const sourceFor = (code: string) => {
    const doc = byCode.get(code);
    if (!doc) return null;
    return (doc.published_content && Object.keys(doc.published_content).length ? doc.published_content : doc.content) || null;
  };

  const sd01 = sourceFor("SD01");
  const sd04 = sourceFor("SD04");
  const sd05 = sourceFor("SD05");
  const pricing01 = (sd01?.pricingProposal || null) as Row | null;
  const revenue04 = (sd04?.partnerRevenueExample || null) as Row | null;
  const pricing04 = Array.isArray(sd04?.pricing) ? sd04?.pricing as Row[] : [];
  const legal05 = Array.isArray(sd05?.legalItems) ? sd05?.legalItems as Row[] : [];
  const rental05 = (sd05?.rentalTemplate || null) as Row | null;

  const monthlyDeposits = n(pricing01?.monthlyDeposits) || n(revenue04?.monthlyActivations);
  const averageDepositAmount = n(pricing01?.averageDepositAmount) || n(revenue04?.averageDeposit);
  const partnerMarginPercent = n(pricing01?.partnerMarginPercent) || n(revenue04?.partnerMarginRate);

  const approvedSecurity = legal05.find(item =>
    text(item.topic).toLowerCase().includes("sécur") ||
    text(item.topic).toLowerCase().includes("secur")
  );
  const sd04Gando = pricing04.find(item => text(item.item).toLowerCase().includes("gando"));
  const gandoRatePercent =
    parsePercent(approvedSecurity?.notes) ||
    n(pricing01?.gandoRatePercent) ||
    parsePercent(sd04Gando?.price) ||
    n(text(rental05?.gandoRate).replace(",", "."));

  const investmentItem = legal05.find(item => text(item.topic).toLowerCase().includes("invest"));
  const oneTimeCost = parseEuro(investmentItem?.notes);

  let stage = text(room.current_stage) || "SD01";
  if (byCode.get("SD05")?.status === "published") stage = "SD05";
  else if (byCode.get("SD04")?.status === "published" && !["SD05"].includes(stage)) stage = "SD04";

  const basis = pricing01 && n(pricing01.monthlyDeposits) > 0
    ? "Dealroom chiffré"
    : monthlyDeposits > 0 && averageDepositAmount > 0
      ? "Proposition / contrat"
      : "À chiffrer";

  return {
    monthlyDeposits,
    averageDepositAmount,
    gandoRatePercent,
    partnerMarginPercent,
    oneTimeCost,
    stage,
    basis,
  };
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!access.canAccessKpi && access.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const [
      roomsResult,
      docsResult,
      economicsResult,
      rulesResult,
      accountRows,
      depositRows,
      operationRows,
    ] = await Promise.all([
      admin
        .from("deal_rooms")
        .select("id,company_name,title,current_stage,status,hubspot_deal_id,company_hubspot_id,updated_at")
        .order("updated_at", { ascending: false }),
      admin
        .from("sd_documents")
        .select("room_id,code,status,content,published_content")
        .in("code", ["SD01", "SD04", "SD05"]),
      admin
        .from("kpi_economics_settings")
        .select("insurance_rate_bps")
        .eq("id", "default")
        .maybeSingle(),
      admin
        .from("kpi_partner_remuneration_rules")
        .select("account_id,enabled,calculation_mode,rate_bps,tiers,effective_from,effective_to"),
      readMirror("accounts"),
      readMirror("deposits"),
      readMirror("client_operations"),
    ]);

    if (roomsResult.error) throw roomsResult.error;
    if (docsResult.error) throw docsResult.error;
    if (economicsResult.error) throw economicsResult.error;
    if (rulesResult.error) throw rulesResult.error;

    const insuranceRate = (n(economicsResult.data?.insurance_rate_bps) || DEFAULT_INSURANCE_RATE_BPS) / 10000;
    const rules = (rulesResult.data || []) as Row[];
    const accounts = buildAccounts(accountRows);
    const deposits = buildDeposits(depositRows);
    const fees = buildFees(operationRows);
    const matches = matchFees(deposits, fees);

    function partnerCostForDeposit(deposit: Deposit, feeAt: number) {
      let costCents = 0;
      for (const rule of rules) {
        if (!bool(rule.enabled) || text(rule.account_id) !== deposit.accountId) continue;
        const effectiveFrom = ts(rule.effective_from);
        const effectiveTo = ts(rule.effective_to);
        if (effectiveFrom != null && feeAt < effectiveFrom) continue;
        if (effectiveTo != null && feeAt > effectiveTo) continue;
        const mode = text(rule.calculation_mode) || "fixed_tier";
        if (mode === "active_volume_rate") {
          if (deposit.status === "active") {
            costCents += Math.round(deposit.amountCents * n(rule.rate_bps) / 10000);
          }
        } else {
          const tiers = Array.isArray(rule.tiers) ? rule.tiers as Tier[] : [];
          costCents += reward(deposit.amountCents, tiers);
        }
      }
      return costCents;
    }

    const latestFeeAt = matches.reduce((max, match) => Math.max(max, match.fee.createdAt || 0), 0);
    const liveWindowStart = Math.max(0, latestFeeAt - LIVE_WINDOW_MS);

    const liveDeals = accounts
      .map(account => {
        const recent = matches.filter(match =>
          match.deposit.accountId === account.id &&
          (match.fee.createdAt || 0) >= liveWindowStart
        );
        if (!recent.length) return null;

        const monthlyDeposits = recent.length;
        const monthlySecuredVolume = recent.reduce((sum, match) => sum + match.deposit.amountCents / 100, 0);
        const monthlyGrossRevenue = recent.reduce((sum, match) => sum + match.fee.amountCents / 100, 0);
        const monthlyInsuranceCost = monthlySecuredVolume * insuranceRate;
        const monthlyPartnerCost = recent.reduce((sum, match) => (
          sum + partnerCostForDeposit(match.deposit, match.fee.createdAt || 0) / 100
        ), 0);
        const monthlyPspCost = monthlyGrossRevenue * PSP_RATE + monthlyDeposits * PSP_FIXED_EUR;
        const monthlyContribution = monthlyGrossRevenue - monthlyInsuranceCost - monthlyPartnerCost - monthlyPspCost;
        const annualGrossRevenue = monthlyGrossRevenue * 12;
        const annualRecurringContribution = monthlyContribution * 12;
        const effectiveRate = monthlySecuredVolume > 0
          ? monthlyGrossRevenue / monthlySecuredVolume * 100
          : account.customRatePercent || 0;

        return {
          id: `live:${account.id}`,
          accountId: account.id,
          companyName: account.name,
          title: account.name,
          stage: "LIVE",
          status: "live",
          enabled: true,
          source: "live",
          basis: "Run-rate réel Gando · 30 jours",
          hubspotDealId: null,
          companyHubspotId: null,
          monthlyDeposits,
          averageDepositAmount: monthlyDeposits > 0 ? monthlySecuredVolume / monthlyDeposits : 0,
          gandoRatePercent: effectiveRate,
          partnerMarginPercent: 0,
          oneTimeCost: 0,
          monthlySecuredVolume,
          monthlyGrossRevenue,
          monthlyInsuranceCost,
          monthlyPartnerCost,
          monthlyPspCost,
          monthlyContribution,
          annualGrossRevenue,
          annualRecurringContribution,
          annualContribution: annualRecurringContribution,
          contributionMargin: monthlyGrossRevenue > 0 ? monthlyContribution / monthlyGrossRevenue : null,
          probability: 1,
          weightedAnnualContribution: annualRecurringContribution,
          actualMonthlyDeposits: monthlyDeposits,
          actualMonthlySecuredVolume: monthlySecuredVolume,
          actualMonthlyGrossRevenue: monthlyGrossRevenue,
          actualMonthlyContribution: monthlyContribution,
          updatedAt: new Date(latestFeeAt || Date.now()).toISOString(),
        };
      })
      .filter((deal): deal is NonNullable<typeof deal> => Boolean(deal));

    const docsByRoom = new Map<string, Array<{ code: string; status: string; content: Row | null; published_content: Row | null }>>();
    for (const doc of docsResult.data || []) {
      const key = String(doc.room_id);
      const list = docsByRoom.get(key) || [];
      list.push({
        code: String(doc.code),
        status: String(doc.status),
        content: (doc.content || null) as Row | null,
        published_content: (doc.published_content || null) as Row | null,
      });
      docsByRoom.set(key, list);
    }

    const roomDeals = (roomsResult.data || [])
      .map(room => {
        const proposal = proposalFromDocuments(room as Row, docsByRoom.get(String(room.id)) || []);
        if (proposal.monthlyDeposits <= 0 || proposal.averageDepositAmount <= 0 || proposal.gandoRatePercent <= 0) {
          return null;
        }

        const monthlySecuredVolume = proposal.monthlyDeposits * proposal.averageDepositAmount;
        const monthlyGrossRevenue = monthlySecuredVolume * (proposal.gandoRatePercent / 100);
        const monthlyInsuranceCost = monthlySecuredVolume * insuranceRate;
        const monthlyPspCost = monthlyGrossRevenue * PSP_RATE + proposal.monthlyDeposits * PSP_FIXED_EUR;
        const monthlyContribution = monthlyGrossRevenue - monthlyInsuranceCost - monthlyPspCost;
        const annualGrossRevenue = monthlyGrossRevenue * 12;
        const annualRecurringContribution = monthlyContribution * 12;
        const annualContribution = annualRecurringContribution - proposal.oneTimeCost;
        const probability = probabilityFor(proposal.stage, text(room.status));

        const live = liveDeals.find(candidate =>
          namesMatch(text(room.company_name) || text(room.title), candidate.companyName)
        );

        return {
          id: String(room.id),
          accountId: live?.accountId || null,
          companyName: text(room.company_name) || text(room.title) || "Deal",
          title: text(room.title),
          stage: live ? "LIVE" : proposal.stage,
          status: live ? "live" : text(room.status),
          enabled: true,
          source: live ? "dealroom+live" : "dealroom",
          basis: live ? `${proposal.basis} + réel Gando` : proposal.basis,
          hubspotDealId: room.hubspot_deal_id ? String(room.hubspot_deal_id) : null,
          companyHubspotId: room.company_hubspot_id ? String(room.company_hubspot_id) : null,
          monthlyDeposits: proposal.monthlyDeposits,
          averageDepositAmount: proposal.averageDepositAmount,
          gandoRatePercent: proposal.gandoRatePercent,
          partnerMarginPercent: proposal.partnerMarginPercent,
          oneTimeCost: proposal.oneTimeCost,
          monthlySecuredVolume,
          monthlyGrossRevenue,
          monthlyInsuranceCost,
          monthlyPartnerCost: 0,
          monthlyPspCost,
          monthlyContribution,
          annualGrossRevenue,
          annualRecurringContribution,
          annualContribution,
          contributionMargin: monthlyGrossRevenue > 0 ? monthlyContribution / monthlyGrossRevenue : null,
          probability: live ? 1 : probability,
          weightedAnnualContribution: annualContribution * (live ? 1 : probability),
          actualMonthlyDeposits: live?.actualMonthlyDeposits || null,
          actualMonthlySecuredVolume: live?.actualMonthlySecuredVolume || null,
          actualMonthlyGrossRevenue: live?.actualMonthlyGrossRevenue || null,
          actualMonthlyContribution: live?.actualMonthlyContribution || null,
          updatedAt: live?.updatedAt || room.updated_at,
        };
      })
      .filter((deal): deal is NonNullable<typeof deal> => Boolean(deal));

    const unmatchedLiveDeals = liveDeals.filter(live =>
      !roomDeals.some(room => namesMatch(room.companyName, live.companyName))
    );

    const deals = [...roomDeals, ...unmatchedLiveDeals]
      .sort((a, b) => b.annualContribution - a.annualContribution);

    const activeDeals = deals.filter(deal => deal.enabled);
    const pipelineAnnualGrossRevenue = activeDeals.reduce((sum, deal) => sum + deal.annualGrossRevenue, 0);
    const pipelineAnnualContribution = activeDeals.reduce((sum, deal) => sum + deal.annualContribution, 0);
    const weightedPipelineContribution = activeDeals.reduce((sum, deal) => sum + deal.weightedAnnualContribution, 0);
    const averageAnnualContribution = activeDeals.length
      ? pipelineAnnualContribution / activeDeals.length
      : 0;

    return NextResponse.json({
      assumptions: {
        insuranceRate,
        pspRate: PSP_RATE,
        pspFixedEur: PSP_FIXED_EUR,
        stageProbability: STAGE_PROBABILITY,
        liveWindowDays: 30,
      },
      summary: {
        activeDeals: activeDeals.length,
        liveDeals: activeDeals.filter(deal => deal.stage === "LIVE").length,
        pipelineAnnualGrossRevenue,
        pipelineAnnualContribution,
        weightedPipelineContribution,
        averageAnnualContribution,
      },
      deals,
    });
  } catch (error) {
    console.error("Deal economics failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de calculer la valeur des deals." },
      { status: 500 },
    );
  }
}
