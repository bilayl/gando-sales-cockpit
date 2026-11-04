import "server-only";
import { withAlloRequest, listWithAlloNumbers, WithAlloError } from "@/lib/withallo";
import { emptyMetrics, fromAlloMetric, metric, metricsFromRecords, recordsBreakdown, type CallRecord } from "@/lib/call-analytics-math";
import type { CallAnalyticsRange, CallAnalyticsResponse, CallAnalyticsView, CallAnalyticsBreakdown, CallMetrics, CallStatsRow, CallFunnelItem } from "@/lib/call-analytics-types";
import type { CockpitAccess } from "@/lib/cockpit-access";

type ObjectData = Record<string, unknown>;
const obj = (v:unknown):ObjectData => v && typeof v==="object" && !Array.isArray(v) ? v as ObjectData : {};
const array = (v:unknown):unknown[] => Array.isArray(v) ? v : [];
const label = (v:unknown):string => typeof v==="string" ? v : "";
const numeric = (v:unknown):number => typeof v==="number" && Number.isFinite(v) ? v : Number(v)||0;
type AlloUser = {id:string;name:string;email:string};
type AlloCall = {id:string;date?:string;direction?:string;result?:string;duration?:number;recording_duration?:number;allo_number?:string;user?:{id?:string;name?:string;email?:string}};
type AlloOverview = {
  summary?:Record<string,unknown>;
  breakdown?:Array<{user?:{id?:string;name?:string;email?:string};calls?:unknown;talk_time_seconds?:unknown;calls_over_1_min?:unknown;answer_rate?:unknown}>;
  last_updated?:string;
};
async function roster():Promise<AlloUser[]> {
  const result=await withAlloRequest<{data?:Array<{id?:string;name?:string;email?:string}>}>("/v2/api/users");
  return array(result.data).map(x=>{
    const v=obj(x);
    return {id:label(v.id),name:label(v.name),email:label(v.email).trim().toLowerCase()};
  }).filter(u=>u.id.length>0);
}
const cmp = (r:CallAnalyticsRange)=>({date:{from:r.from,to:r.to},compare_date:{from:r.previousFrom,to:r.previousTo}});
const filters = (breakdown:CallAnalyticsBreakdown,filterId:string|null,forcedUser:string|null)=> forcedUser?{user_ids:[forcedUser]}:
  breakdown==="user"&&filterId?{user_ids:[filterId]}:
  breakdown==="phone"&&filterId?{allo_numbers:[filterId]}:{};
function toMetrics(data:AlloOverview):CallMetrics {
  const s=obj(data.summary);
  return {
    calls:fromAlloMetric(s.total_calls),
    talkSeconds:fromAlloMetric(s.talk_time_seconds),
    longCalls:fromAlloMetric(s.calls_over_1_min),
    answerRate:fromAlloMetric(s.answer_rate),
  };
}
function toRows(data:AlloOverview):CallStatsRow[] {
  return array(data.breakdown).flatMap(item=>{
    const v=obj(item),user=obj(v.user);
    const id=label(user.id);
    if(!id)return [];
    return [{
      id,name:label(user.name)||label(user.email)||id,subtitle:label(user.email)||null,
      metrics:{
        calls:fromAlloMetric(v.calls),talkSeconds:fromAlloMetric(v.talk_time_seconds),
        longCalls:fromAlloMetric(v.calls_over_1_min),answerRate:fromAlloMetric(v.answer_rate),
      },
    }];
  }).sort((a,b)=>b.metrics.calls.value-a.metrics.calls.value||a.name.localeCompare(b.name,"fr"));
}
async function overview(range:CallAnalyticsRange,userFilter:string|null,phoneFilter:string|null):Promise<AlloOverview>{
  const parameters={...cmp(range),...(userFilter?{user_ids:[userFilter]}:{}),...(phoneFilter?{allo_numbers:[phoneFilter]}:{})};
  const result=await withAlloRequest<{data?:AlloOverview}>("/v2/api/analytics/overview",{
    method:"POST",body:JSON.stringify(parameters),
  });
  if(!result.data || typeof result.data!=="object")throw new WithAlloError("La réponse Analytics d’Allo ne contient pas de statistiques.",502);
  return result.data;
}
async function outbound(range:CallAnalyticsRange,filter:Record<string,string[]>):Promise<{funnel:CallFunnelItem[];lastUpdated:string|null}>{
  const result=await withAlloRequest<{data?:Record<string,unknown>}>("/v2/api/analytics/outbound",{
    method:"POST",body:JSON.stringify({...cmp(range),...filter,granularity:"DAY"}),
  });
  const data=obj(result.data),stages=obj(data.funnel);
  const funnel:CallFunnelItem[]=[
    ["dials","Appels lancés"],["connected","Décrochés"],["conversations","Conversations > 1 min"],["conversions","Conversions taguées"],
  ].map(([key,name])=>{
    const stage=obj(stages[key]);
    return {key,name,metric:fromAlloMetric(stage.count),rate:stage.rate==null?null:numeric(stage.rate)};
  });
  return {funnel,lastUpdated:label(data.last_updated)||null};
}
async function searchCalls(range:{from:string;to:string},direction:"INBOUND"|"OUTBOUND",userId:string|null,number:string|null){
  const calls:AlloCall[]=[];
  let partial=false;
  for(let page=1;page<=10;page++){
    const query={type:"CALL",direction,sort:"DATE_DESC",date:range,page,size:100,...(userId?{user_id:userId}:{}),...(number?{allo_number:number}:{})};
    const response=await withAlloRequest<{data?:AlloCall[];pagination?:{has_more?:boolean}}>("/v2/api/conversations/items/search",{method:"POST",body:JSON.stringify(query)});
    const results=Array.isArray(response.data)?response.data:[];
    calls.push(...results);
    if(!response.pagination?.has_more)break;
    if(page===10)partial=true;
  }
  return {calls,partial};
}
function toCallRecord(call:AlloCall, names:Map<string,AlloUser>):CallRecord {
  const userId=label(call.user?.id)||"unknown";
  const user=names.get(userId);
  const phone=label(call.allo_number)||"unknown";
  const result=label(call.result).toUpperCase();
  const answered=result==="ANSWERED"||result==="TRANSFERRED";
  const totalTime=numeric(call.duration);
  const recordingTime=numeric(call.recording_duration);
  return {
    ownerKey:userId,ownerName:label(call.user?.name)||user?.name||user?.email||"Commercial non renseigné",
    ownerSubtitle:user?.email||label(call.user?.email)||null,
    phoneKey:phone,phoneName:phone==="unknown"?"Numéro Allo inconnu":phone,
    direction:label(call.direction),
    answered,
    talkSeconds:answered?Math.max(0,recordingTime||totalTime):0,
    durationSeconds:Math.max(0,totalTime),
  };
}
export async function withAlloCallAnalytics(args:{
  access:CockpitAccess;range:CallAnalyticsRange;view:CallAnalyticsView;breakdown:CallAnalyticsBreakdown;filterId:string|null;
}):Promise<CallAnalyticsResponse>{
  const {access,range,view,breakdown}=args;
  const canCompareTeam=access.role==="admin";
  let users:AlloUser[]=[];
  try { users=await roster(); }
  catch(error) {
    if(!canCompareTeam)throw new WithAlloError("Impossible de vérifier votre identité Allo (permission USERS_READ requise sur la clé API).",403);
  }
  const forcedUser=!canCompareTeam?users.find(u=>u.email===access.email?.toLowerCase())?.id||null:null;
  if(!canCompareTeam&&!forcedUser)throw new WithAlloError("Votre compte Gando ne correspond à aucun utilisateur Allo. Vérifiez l’adresse e-mail de votre compte.",403);
  const lines=canCompareTeam?await listWithAlloNumbers().catch(()=>[]):[];
  const userOptions=users.map(u=>({id:u.id,label:u.name||u.email||u.id}));
  const phoneOptions=lines.map(l=>({id:l.number,label:l.name===l.number?l.number:l.name+" · "+l.number}));
  const filterId=canCompareTeam&&args.filterId&&(
    breakdown==="user"?(/^[\w-]+$/.test(args.filterId)&& (users.length===0||users.some(u=>u.id===args.filterId))):
    lines.some(l=>l.number===args.filterId)
  )?args.filterId:null;
  const selectedUser=forcedUser||(breakdown==="user"?filterId:null);
  const selectedNumber=canCompareTeam&&breakdown==="phone"?filterId:null;
  const notes=["Source Allo : statistiques calculées par Allo et distinctes des activités HubSpot CRM, pour éviter les doubles comptes."];
  if(view==="power") {
    return {source:"allo",view,breakdown,period:range,metrics:emptyMetrics(),rows:[],userOptions,phoneOptions,filterId,
      canCompareTeam,updatedAt:null,funnel:[],notes:["L’API Analytics Allo ne fournit pas de ventilation historique permettant d’isoler exclusivement les appels du Power Dialer. Consultez sa rubrique Power Dialer ; aucun appel n’est attribué artificiellement à ce canal."],partial:false};
  }
  if(view==="overview") {
    const base=await overview(range,selectedUser,selectedNumber);
    const rows=breakdown==="user" ? toRows(base) : [];
    let partial=false;
    if(breakdown==="phone"&&canCompareTeam){
      const relevant=selectedNumber?lines.filter(l=>l.number===selectedNumber):lines;
      const sampled=relevant.slice(0,10);
      const result=await Promise.allSettled(sampled.map(l=>overview(range,null,l.number)));
      for(let i=0;i<result.length;i++){
        const item=result[i];
        if(item.status==="fulfilled") rows.push({
          id:sampled[i].number,name:sampled[i].name||sampled[i].number,subtitle:sampled[i].number,
          metrics:toMetrics(item.value),
        });
        else partial=true;
      }
      rows.sort((a,b)=>b.metrics.calls.value-a.metrics.calls.value||a.name.localeCompare(b.name,"fr"));
      if(relevant.length>10){partial=true;notes.push("La comparaison par ligne est limitée aux dix premiers numéros Allo ; choisissez une ligne précise pour obtenir ses chiffres.");}
      if(result.some(x=>x.status==="rejected"))notes.push("Certaines lignes n’ont pas pu être chargées depuis l’API Allo.");
      if(!lines.length)notes.push("L’accès à la liste des lignes nécessite la permission NUMBERS_READ sur la clé Allo.");
    }
    if(breakdown==="phone"&&!canCompareTeam)notes.push("La comparaison par ligne est réservée aux administrateurs pour ne pas exposer l’activité de collègues.");
    if(rows.length===0 && breakdown==="user" && selectedUser && toMetrics(base).calls.value>0){
      const u=users.find(x=>x.id===selectedUser);
      rows.push({id:selectedUser,name:u?.name||u?.email||"Mes appels",subtitle:u?.email||null,metrics:toMetrics(base)});
    }
    return {source:"allo",view,breakdown,period:range,metrics:toMetrics(base),rows,userOptions,phoneOptions,
      filterId:selectedUser||selectedNumber,canCompareTeam,updatedAt:base.last_updated||null,funnel:[],notes,partial};
  }
  const direction=view==="inbound"?"INBOUND":"OUTBOUND";
  const names=new Map(users.map(x=>[x.id,x]));
  const [c,p,extra]=await Promise.all([
    searchCalls({from:range.from,to:range.to},direction,selectedUser,selectedNumber),
    searchCalls({from:range.previousFrom,to:range.previousTo},direction,selectedUser,selectedNumber),
    view==="outbound"?outbound(range,filters(breakdown,filterId,forcedUser)).catch(()=>null):Promise.resolve(null),
  ]);
  const current=c.calls.map(call=>toCallRecord(call,names));
  const previous=p.calls.map(call=>toCallRecord(call,names));
  const rows=recordsBreakdown(current,previous,breakdown);
  if(c.partial||p.partial)notes.push("La liste dépasse 1 000 appels par période : choisissez une période plus courte pour obtenir des chiffres complets.");
  if(view==="outbound")notes.push("L’entonnoir sortant est fourni par l’API Analytics Allo ; les tableaux détaillés sont recalculés sur les appels retrouvés pour cette période.");
  if(view==="inbound")notes.push("Le taux de réponse des entrants est calculé sur les appels Allo dont le statut est ANSWERED ou TRANSFERRED.");
  return {source:"allo",view,breakdown,period:range,metrics:metricsFromRecords(current,previous),rows,userOptions,phoneOptions,
    filterId:selectedUser||selectedNumber,canCompareTeam,updatedAt:extra?.lastUpdated||new Date().toISOString(),
    funnel:extra?.funnel||[],notes,partial:c.partial||p.partial};
}
