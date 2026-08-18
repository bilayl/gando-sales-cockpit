import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hubspotJson } from "@/lib/hubspot";
import { ensureCompanyQualificationProperties } from "@/lib/hubspot/qualification-schema";
import { findSourcingDuplicate, listHubSpotCompaniesForSourcing, type SourcingProspect } from "@/lib/enrichment-dedup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const input = await request.json().catch(() => ({}));
    const prospects = (Array.isArray(input.prospects) ? input.prospects.slice(0, 50) : []) as SourcingProspect[];
    if (!prospects.length) return NextResponse.json({ error: "Sélectionnez au moins une entreprise." }, { status: 400 });

    const [companies, schema] = await Promise.all([
      listHubSpotCompaniesForSourcing(),
      ensureCompanyQualificationProperties().catch(() => ({ available: [] as string[] })),
    ]);

    const imported: Array<{ companyName: string; hubspotCompanyId: string }> = [];
    const skipped: Array<{ companyName: string; reason: string; hubspotCompanyId?: string }> = [];
    const rows: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (const prospect of prospects) {
      if (!prospect?.companyName?.trim()) {
        skipped.push({ companyName: "Unknown", reason: "missing_company_name" });
        continue;
      }

      const duplicate = findSourcingDuplicate(prospect, companies);
      if (duplicate) {
        skipped.push({
          companyName: prospect.companyName,
          reason: duplicate.reason,
          hubspotCompanyId: duplicate.company.id,
        });
        continue;
      }

      const properties: Record<string, string> = {
        name: prospect.companyName.trim(),
        hs_lead_status: "NEW",
      };
      if (schema.available.includes("statut_prospection")) properties.statut_prospection = "À travailler";
      if (prospect.domain) properties.domain = prospect.domain;
      if (prospect.website) properties.website = prospect.website;
      if (prospect.phone) properties.phone = prospect.phone;
      if (prospect.city) properties.city = prospect.city;
      if (prospect.country) properties.country = prospect.country;
      if (prospect.sourceUrls?.length) {
        properties.description = [
          prospect.qualificationReason ? `Qualification sourcing : ${prospect.qualificationReason}` : "",
          prospect.evidence ? `Preuve : ${prospect.evidence}` : "",
          `Sources : ${prospect.sourceUrls.join(" | ")}`,
        ].filter(Boolean).join("\n");
      }

      const created = await hubspotJson("/crm/objects/2026-03/companies", {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
      const hubspotCompanyId = String(created.id);
      imported.push({ companyName: prospect.companyName, hubspotCompanyId });
      companies.push({
        id: hubspotCompanyId,
        name: properties.name,
        domain: properties.domain,
        website: properties.website,
        phone: properties.phone,
        city: properties.city,
      });

      rows.push({
        hubspot_id: hubspotCompanyId,
        name: properties.name,
        domain: properties.domain ?? null,
        phone: properties.phone ?? null,
        website: properties.website ?? null,
        city: properties.city ?? null,
        country: properties.country ?? null,
        raw_data: { ...created, properties: { ...(created.properties || {}), ...properties }, updatedAt: now },
        hubspot_updated_at: created.updatedAt || now,
      });
    }

    if (rows.length) {
      const { error } = await getSupabaseAdmin().from("companies").upsert(rows, { onConflict: "hubspot_id" });
      if (error) console.error("Supabase sourcing import:", error.message);
    }

    return NextResponse.json({
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Erreur d'import sourcing" }, { status: e.status || 502 });
  }
}
