import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SearchFilter = "all" | "contacts" | "companies";

function sanitizeSearch(value: string) {
  return value
    .replace(/[,%_()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function contactResult(row: any) {
  const properties = row.raw_data?.properties ?? {};
  const firstName = row.first_name || properties.firstname || "";
  const lastName = row.last_name || properties.lastname || "";
  const title = [firstName, lastName].filter(Boolean).join(" ").trim()
    || row.email
    || properties.email
    || row.phone
    || properties.phone
    || "Contact sans nom";

  return {
    id: String(row.hubspot_id),
    type: "contact" as const,
    title,
    subtitle: row.email || properties.email || row.phone || properties.phone || "",
    meta: row.job_title || properties.jobtitle || properties.company || "",
    href: `/contacts/${row.hubspot_id}`,
  };
}

function companyResult(row: any) {
  const properties = row.raw_data?.properties ?? {};
  const name = row.name || properties.name || row.domain || properties.domain || "Entreprise sans nom";

  return {
    id: String(row.hubspot_id),
    type: "company" as const,
    title: name,
    subtitle: row.domain || properties.domain || row.phone || properties.phone || "",
    meta: [row.city || properties.city, row.country || properties.country].filter(Boolean).join(" · "),
    href: `/companies/${row.hubspot_id}`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = sanitizeSearch(url.searchParams.get("q") || "");
    const rawFilter = url.searchParams.get("filter") || "all";
    const filter: SearchFilter = rawFilter === "contacts" || rawFilter === "companies" ? rawFilter : "all";

    if (query.length < 2) {
      return NextResponse.json({ results: [], query, filter });
    }

    const supabase = getSupabaseAdmin();
    const pattern = `%${query}%`;

    const [contactsResponse, companiesResponse] = await Promise.all([
      filter === "companies"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("contacts")
            .select("hubspot_id,first_name,last_name,email,phone,job_title,raw_data")
            .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
            .order("hubspot_updated_at", { ascending: false, nullsFirst: false })
            .limit(filter === "contacts" ? 12 : 6),
      filter === "contacts"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("companies")
            .select("hubspot_id,name,domain,phone,city,country,raw_data")
            .or(`name.ilike.${pattern},domain.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern}`)
            .order("hubspot_updated_at", { ascending: false, nullsFirst: false })
            .limit(filter === "companies" ? 12 : 6),
    ]);

    if (contactsResponse.error) throw contactsResponse.error;
    if (companiesResponse.error) throw companiesResponse.error;

    const results = [
      ...(companiesResponse.data ?? []).map(companyResult),
      ...(contactsResponse.data ?? []).map(contactResult),
    ];

    return NextResponse.json(
      { results, query, filter },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const reason = error as Error;
    return NextResponse.json(
      { error: reason.message || "Recherche CRM indisponible" },
      { status: 500 },
    );
  }
}
