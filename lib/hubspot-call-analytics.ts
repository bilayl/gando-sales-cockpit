import "server-only";
import { hubspotJson } from "@/lib/hubspot";
import { epochBounds } from "@/lib/call-analytics-period";
import { classifyHubSpotAnswer, isNrP } from "@/lib/call-outcome";
import { emptyMetrics, metricsFromRecords, recordsBreakdown, type CallRecord } from "@/lib/call-analytics-math";
import type { CallAnalyticsRange, CallAnalyticsResponse, CallAnalyticsView, CallAnalyticsBreakdown, CallStatsOption, CallAnalyticsInsights } from "@/lib/call-analytics-types";
import type { CockpitAccess } from "@/lib/cockpit-access";

type HubspotRow = { id: string; properties?: Record<string, string | null | undefined> };
type HubspotSearch = { results?: HubspotRow[]; paging?: { next?: { after?: string } } };
type HubspotOwner = { id: string; email?: string; firstName?: string; lastName?: string; teams?: unknown[] };
const PROPERTIES = ["hs_timestamp","hubspot_owner_id","hs_call_title","hs_call_status","hs_call_disposition","hs_call_direction","hs_call_duration","hs_call_owner_talk_time","hs_call_to_number","hs_call_from_number","hs_inbound_call_answer_status","hs_call_has_transcript","hs_call_summary","hs_call_body","hs_call_has_voicemail","allo_tags"];
function callAnswered(p:Record<string,string|null|undefined>) {
  return classifyHubSpotAnswer(p)==="answered";
}
function callUnanswered(p:Record<string,string|null|undefined>) {
  return classifyHubSpotAnswer(p)==="unanswered";
}
function callMarkedNrP(p:Record<string,string|null|undefined>) {
  return [p.allo_tags,p.hs_call_title,p.hs_call_body].some(isNrP);
}
function isoNumber(value: string | null | undefined) {
  return (value || "").trim().replace(/[\s().-]/g,"") || null;
}
function callRecord(item: HubspotRow, owners: Map<string, HubspotOwner>): CallRecord {
  const p = item.properties || {};
  const ownerId = p.hubspot_owner_id || "unassigned";
  const owner = owners.get(ownerId);
  const name = [owner?.firstName,owner?.lastName].filter(Boolean).join(" ").trim() || owner?.email || (ownerId === "unassigned" ? "Non attribué" : "Responsable " + ownerId);
  const direction = p.hs_call_direction || "UNKNOWN";
  const callDuration = Math.max(0, Number(p.hs_call_duration || 0) / 1000);
  const answered = callAnswered(p);
  const knownOwnerTime = p.hs_call_owner_talk_time != null && p.hs_call_owner_talk_time !== "" ? Number(p.hs_call_owner_talk_time) : NaN;
  const talkSeconds = answered ? Math.max(0,Number.isFinite(knownOwnerTime) ? knownOwnerTime : callDuration) : 0;
  const phone = isoNumber(direction === "INBOUND" ? p.hs_call_to_number : p.hs_call_from_number) || "unknown";
  return {
    ownerKey: ownerId, ownerName: name, ownerSubtitle: owner?.email || null,
    phoneKey:phone,phoneName:phone==="unknown"?"Ligne non renseignée":phone,
    direction,answered,talkSeconds,durationSeconds:callDuration,
  };
}
async function getOwners(): Promise<Map<string,HubspotOwner>> {
  const out = new Map<string,HubspotOwner>();
  let after: string | undefined;
  for(let n=0;n<5;n++) {
    const q = new URLSearchParams({ limit: "100" });
    if(after)q.set("after",after);
    const res = await hubspotJson("/crm/v3/owners?"+q.toString()) as { results?: HubspotOwner[]; paging?:{next?:{after?:string}} };
    for(const owner of res.results || [])if(owner.id)out.set(String(owner.id),owner);
    after = res.paging?.next?.after;
    if(!after)break;
  }
  return out;
}
async function searchCalls(from:string,to:string,ownerId?:string) {
  const bounds = epochBounds(from,to);
  const rows:HubspotRow[]=[];
  let after:string|undefined;
  let partial=false;
  for(let page=0;page<20;page++) {
    const filters: Array<{propertyName:string;operator:string;value:string}> = [
      { propertyName:"hs_timestamp",operator:"GTE",value:String(bounds.from) },
      { propertyName:"hs_timestamp",operator:"LT",value:String(bounds.toExclusive) },
    ];
    if(ownerId)filters.push({propertyName:"hubspot_owner_id",operator:"EQ",value:ownerId});
    const body: Record<string, unknown> = {
      limit:200,properties:PROPERTIES,
      filterGroups:[{filters}],
      sorts:[{propertyName:"hs_timestamp",direction:"DESCENDING"}],
      ...(after?{after}:{}),
    };
    const response = await hubspotJson("/crm/objects/2026-03/calls/search",{method:"POST",body:JSON.stringify(body)}) as HubspotSearch;
    rows.push(...(response.results||[]));
    after=response.paging?.next?.after;
    if(!after)break;
    if(page===19)partial=true;
  }
  return {rows,partial};
}
export async function hubspotCallAnalytics(args:{
  access:CockpitAccess;range:CallAnalyticsRange;view:CallAnalyticsView;breakdown:CallAnalyticsBreakdown;filterId:string|null;
}):Promise<CallAnalyticsResponse>{
  const {access,range,view,breakdown,filterId}=args;
  const owners=await getOwners();
  const canCompareTeam=access.role==="admin";
  const owner = !canCompareTeam ? [...owners.values()].find(o => o.email?.toLowerCase()===access.email?.toLowerCase()) : undefined;
  if(!canCompareTeam && !owner) {
    return {source:"hubspot",view,breakdown,period:range,metrics:emptyMetrics(),rows:[],userOptions:[],phoneOptions:[],filterId:null,canCompareTeam,updatedAt:new Date().toISOString(),funnel:[],partial:false,notes:["Aucun responsable HubSpot ne correspond à votre adresse e-mail Gando. Les données de l’équipe ne sont pas exposées à ce compte."]};
  }
  const allowedId=canCompareTeam && breakdown==="user" && filterId && owners.has(filterId)?filterId:undefined;
  const ownerId=canCompareTeam ? allowedId : String(owner!.id);
  const [a,b]=await Promise.all([searchCalls(range.from,range.to,ownerId),searchCalls(range.previousFrom,range.previousTo,ownerId)]);
  const convert=(rows:HubspotRow[])=>rows.map(item=>callRecord(item,owners));
  const filterDirection=(rows:CallRecord[])=>view==="outbound"?rows.filter(x=>x.direction==="OUTBOUND"):view==="inbound"?rows.filter(x=>x.direction==="INBOUND"):view==="power"?[]:rows;
  const current=filterDirection(convert(a.rows));
  const previous=filterDirection(convert(b.rows));
  const byRows=recordsBreakdown(current,previous,breakdown);
  const userOptions:CallStatsOption[] = canCompareTeam ? [...owners.values()].map(o=>({id:String(o.id),label:[o.firstName,o.lastName].filter(Boolean).join(" ")||o.email||String(o.id)})).sort((x,y)=>x.label.localeCompare(y.label,"fr")) : [{id:String(owner!.id),label:[owner!.firstName,owner!.lastName].filter(Boolean).join(" ") || owner!.email || "Mes appels"}];
  const phones=[...new Set(convert(a.rows).map(r=>r.phoneKey).filter(p=>p!=="unknown"))].sort();
  const selectedPhone=canCompareTeam && breakdown==="phone" && filterId && phones.includes(filterId)?filterId:null;
  const phoneFiltered=selectedPhone ? current.filter(x=>x.phoneKey===selectedPhone):current;
  const oldPhoneFiltered=selectedPhone ? previous.filter(x=>x.phoneKey===selectedPhone):previous;
  const rows=recordsBreakdown(phoneFiltered,oldPhoneFiltered,breakdown);
  const sourceRows=a.rows.filter(item=>{
    const p=item.properties||{};
    if(view==="outbound"&&p.hs_call_direction!=="OUTBOUND")return false;
    if(view==="inbound"&&p.hs_call_direction!=="INBOUND")return false;
    if(selectedPhone && ((p.hs_call_direction==="INBOUND"?p.hs_call_to_number:p.hs_call_from_number)||"").replace(/[\s().-]/g,"")!==selectedPhone)return false;
    return true;
  });
  const insights:CallAnalyticsInsights={
    answered:sourceRows.filter(x=>callAnswered(x.properties||{})).length,
    nrp:sourceRows.filter(x=>callMarkedNrP(x.properties||{})).length,
    missedOrVoicemail:sourceRows.filter(x=>callUnanswered(x.properties||{})).length,
    unknownOutcome:sourceRows.filter(x=>{
      const p=x.properties||{};
      return classifyHubSpotAnswer(p)==="unknown";
    }).length,
    transcribed:sourceRows.filter(x=>String(x.properties?.hs_call_has_transcript||"").toLowerCase()==="true").length,
    summarized:sourceRows.filter(x=>Boolean(x.properties?.hs_call_summary)).length,
    actionedCalls:null,actionSuggestions:null,checkedCalls:sourceRows.length,partial:a.partial,source:"HubSpot CRM"
  };
  const notes=["Source HubSpot CRM : activités téléphoniques réellement enregistrées dans le CRM, y compris les anciens appels Onoff. Elles ne sont pas additionnées aux appels Allo.",
    "Le taux de réponse utilise les issues commerciales HubSpot : NRP, No answer, répondeur et messagerie ne comptent jamais comme répondus, même si le statut technique est COMPLETED."];
  if(view==="power")notes.push("HubSpot ne renseigne pas de manière fiable le mode Power Dialer dans les activités d’appel : aucun chiffre n’est attribué artificiellement à ce mode.");
  if(a.partial||b.partial)notes.push("Le volume de la période dépasse la limite de 4 000 appels par période : statistiques incomplètes. Réduisez la période.");
  return {source:"hubspot",view,breakdown,period:range,metrics:metricsFromRecords(phoneFiltered,oldPhoneFiltered),
    rows,filterId:breakdown==="user"?ownerId||null:selectedPhone,canCompareTeam,
    userOptions,phoneOptions:phones.map(id=>({id,label:id})),
    updatedAt:new Date().toISOString(),funnel:[],insights,partial:a.partial||b.partial,notes};
}
