import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getCallAnalyticsRange, InvalidAnalyticsPeriod } from "@/lib/call-analytics-period";
import { withAlloCallAnalytics } from "@/lib/withallo-call-analytics";
import { hubspotCallAnalytics } from "@/lib/hubspot-call-analytics";
import type { CallAnalyticsBreakdown, CallAnalyticsView } from "@/lib/call-analytics-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const access=await requireCockpitAccess();
    const query=request.nextUrl.searchParams;
    const source=query.get("source") || "allo";
    const view=query.get("view") || "overview";
    const breakdown=query.get("breakdown") || "user";
    const period=query.get("period") || "week";
    if(!["allo","hubspot"].includes(source) ||
       !["overview","outbound","inbound","power"].includes(view) ||
       !["user","phone"].includes(breakdown)){
      return NextResponse.json({error:"Paramètres des statistiques incorrects."},{status:400});
    }
    const range=getCallAnalyticsRange(period,query.get("from"),query.get("to"));
    const filterId=query.get("filter")?.trim().slice(0,128) || null;
    const args={access,range,view:view as CallAnalyticsView,breakdown:breakdown as CallAnalyticsBreakdown,filterId};
    const data=source==="hubspot"?await hubspotCallAnalytics(args):await withAlloCallAnalytics(args);
    return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) {
    const raw=Number((error as {status?:number})?.status || 502);
    const status=error instanceof InvalidAnalyticsPeriod?400:[400,401,403,404,429,503].includes(raw)?raw:502;
    return NextResponse.json(
      {error:error instanceof Error?error.message:"Statistiques d’appels indisponibles."},
      {status,headers:{"Cache-Control":"private, no-store"}},
    );
  }
}
