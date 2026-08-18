import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_ENRICHMENT_BACKEND_URL = "https://gando-enrichment-backend-lenrigandoyt-9842s-projects.vercel.app";

function config() {
  const baseUrl = (process.env.ENRICHMENT_BACKEND_URL || process.env.GANDO_ENRICHMENT_BACKEND_URL || DEFAULT_ENRICHMENT_BACKEND_URL).replace(/\/$/, "");
  const apiKey = process.env.ENRICHMENT_INTERNAL_API_KEY || process.env.GANDO_ENRICHMENT_API_KEY || process.env.INTERNAL_API_KEY || "";
  return { baseUrl, apiKey };
}

function prospectByName(prospects: any[]) {
  return new Map(prospects.map(prospect => [String(prospect.companyName || "").trim().toLowerCase(), prospect]));
}

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey } = config();
    if (!apiKey) {
      return NextResponse.json({
        error: "La clé interne du backend de sourcing n'est pas configurée sur le Sales Cockpit.",
        code: "ENRICHMENT_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const input = await request.json().catch(() => ({}));
    const prospects = Array.isArray(input.prospects) ? input.prospects.slice(0, 50) : [];
    if (!prospects.length) return NextResponse.json({ error: "Sélectionnez au moins une entreprise." }, { status: 400 });

    const response = await fetch(`${baseUrl}/api/hubspot/companies/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gando-api-key": apiKey,
      },
      body: JSON.stringify({ prospects }),
      cache: "no-store",
      signal: AbortSignal.timeout(58_000),
    });

    const payload = await response.json().catch(() => ({ error: `Backend sourcing: HTTP ${response.status}` }));
    if (!response.ok) {
      return NextResponse.json({
        error: payload.error || payload.message || "Le backend de sourcing a rejeté l'import.",
        upstreamStatus: response.status,
      }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
    }

    const imported = Array.isArray(payload.imported) ? payload.imported : [];
    if (imported.length) {
      const lookup = prospectByName(prospects);
      const now = new Date().toISOString();
      const rows = imported.map((item: any) => {
        const prospect = lookup.get(String(item.companyName || "").trim().toLowerCase()) || {};
        const properties = {
          name: item.companyName || prospect.companyName || "Entreprise sourcée",
          domain: prospect.domain || null,
          website: prospect.website || null,
          phone: prospect.phone || null,
          city: prospect.city || null,
          country: prospect.country || "France",
          hs_lead_status: "NEW",
          statut_prospection: "À travailler",
        };
        return {
          hubspot_id: String(item.hubspotCompanyId),
          name: properties.name,
          domain: properties.domain,
          phone: properties.phone,
          website: properties.website,
          city: properties.city,
          country: properties.country,
          raw_data: { id: String(item.hubspotCompanyId), properties, createdAt: now, updatedAt: now },
          hubspot_updated_at: now,
        };
      });
      const { error } = await getSupabaseAdmin().from("companies").upsert(rows, { onConflict: "hubspot_id" });
      if (error) console.error("Supabase sourcing import:", error.message);
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error
      ? error.name === "TimeoutError" ? "L'import a dépassé le délai maximum." : error.message
      : "Erreur d'import sourcing";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
