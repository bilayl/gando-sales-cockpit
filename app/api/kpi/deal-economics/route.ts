import { NextResponse } from "next/server";
import { getCockpitAccess } from "@/lib/cockpit-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PSP_RATE = 0.016;
const PSP_FIXED_EUR = 0.35;

const STAGE_PROBABILITY: Record<string, number> = {
  SD01: 0.15,
  SD02: 0.3,
  SD03: 0.5,
  SD04: 0.75,
  SD05: 0.9,
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function probabilityFor(stage: string, status: string) {
  if (status === "signed" || status === "won") return 1;
  return STAGE_PROBABILITY[stage] ?? 0.1;
}

export async function GET() {
  try {
    const access = await getCockpitAccess();
    if (!access) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!access.canAccessKpi && access.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const [roomsResult, docsResult, economicsResult] = await Promise.all([
      admin
        .from("deal_rooms")
        .select("id,company_name,title,current_stage,status,hubspot_deal_id,company_hubspot_id,updated_at")
        .order("updated_at", { ascending: false }),
      admin
        .from("sd_documents")
        .select("room_id,content,published_content,status")
        .eq("code", "SD01"),
      admin
        .from("kpi_economics_settings")
        .select("insurance_rate_bps")
        .eq("id", "default")
        .maybeSingle(),
    ]);

    if (roomsResult.error) throw roomsResult.error;
    if (docsResult.error) throw docsResult.error;
    if (economicsResult.error) throw economicsResult.error;

    const insuranceRate = n(economicsResult.data?.insurance_rate_bps) / 10000;
    const docsByRoom = new Map(
      (docsResult.data || []).map(row => [String(row.room_id), row])
    );

    const deals = (roomsResult.data || [])
      .map(room => {
        const doc = docsByRoom.get(String(room.id));
        const source = (doc?.published_content && Object.keys(doc.published_content).length
          ? doc.published_content
          : doc?.content) as Record<string, unknown> | null | undefined;

        const pricing = (source?.pricingProposal || null) as Record<string, unknown> | null;
        if (!pricing) return null;

        const monthlyDeposits = n(pricing.monthlyDeposits);
        const averageDepositAmount = n(pricing.averageDepositAmount);
        const gandoRatePercent = n(pricing.gandoRatePercent);
        const partnerMarginPercent = n(pricing.partnerMarginPercent);
        const enabled = pricing.enabled !== false;

        const monthlySecuredVolume = monthlyDeposits * averageDepositAmount;
        const monthlyGrossRevenue = monthlySecuredVolume * (gandoRatePercent / 100);
        const monthlyInsuranceCost = monthlySecuredVolume * insuranceRate;
        const monthlyPspCost = monthlyGrossRevenue * PSP_RATE + monthlyDeposits * PSP_FIXED_EUR;
        const monthlyContribution = monthlyGrossRevenue - monthlyInsuranceCost - monthlyPspCost;
        const annualGrossRevenue = monthlyGrossRevenue * 12;
        const annualContribution = monthlyContribution * 12;
        const contributionMargin = monthlyGrossRevenue > 0 ? monthlyContribution / monthlyGrossRevenue : null;
        const stage = text(room.current_stage) || "SD01";
        const probability = probabilityFor(stage, text(room.status));
        const weightedAnnualContribution = annualContribution * probability;

        return {
          id: String(room.id),
          companyName: text(room.company_name) || text(room.title) || "Deal",
          title: text(room.title),
          stage,
          status: text(room.status),
          enabled,
          hubspotDealId: room.hubspot_deal_id ? String(room.hubspot_deal_id) : null,
          companyHubspotId: room.company_hubspot_id ? String(room.company_hubspot_id) : null,
          monthlyDeposits,
          averageDepositAmount,
          gandoRatePercent,
          partnerMarginPercent,
          monthlySecuredVolume,
          monthlyGrossRevenue,
          monthlyInsuranceCost,
          monthlyPspCost,
          monthlyContribution,
          annualGrossRevenue,
          annualContribution,
          contributionMargin,
          probability,
          weightedAnnualContribution,
          updatedAt: room.updated_at,
        };
      })
      .filter((deal): deal is NonNullable<typeof deal> =>
        Boolean(deal && deal.monthlyDeposits > 0 && deal.averageDepositAmount > 0 && deal.gandoRatePercent > 0)
      );

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
      },
      summary: {
        activeDeals: activeDeals.length,
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
