import { NextResponse } from "next/server";
import { discoverPublicWebsiteContacts } from "@/lib/website-contact-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const cases = [
    { name: "BlgCloud", website: "https://www.blgcloud.fr" },
    { name: "Locaway", website: "https://locaway.com" },
  ];

  const results = await Promise.all(cases.map(async item => {
    const discovery = await discoverPublicWebsiteContacts({ website: item.website });
    return {
      name: item.name,
      website: item.website,
      phone: discovery.phone,
      email: discovery.email,
      pagesVisited: discovery.pagesVisited,
      errors: discovery.errors,
    };
  }));

  return NextResponse.json({ ok: true, source: "website_only", results }, {
    headers: { "cache-control": "no-store" },
  });
}
