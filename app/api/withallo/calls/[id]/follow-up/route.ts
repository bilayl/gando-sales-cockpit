import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { getAuthorizedAlloCall } from "@/lib/withallo-recordings";
import { shapeWithAlloCallDetail } from "@/lib/withallo-call-detail";
import { createTask } from "@/lib/hubspot/tasks";
import { hubspotJson } from "@/lib/hubspot";
import { resolveCockpitTaskAssignee, saveCockpitTaskAssignee } from "@/lib/cockpit-task-assignment";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeWithAlloDialNumber } from "@/lib/withallo-phone";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const TYPES = new Set(["CALL", "EMAIL", "TODO", "MEETING"]);

function possiblePhones(number: string | null): string[] {
  if(!number)return [];
  const candidate=normalizeWithAlloDialNumber(number);
  if(!candidate)return [];
  const all=new Set([number.trim(),candidate]);
  if(candidate.startsWith("+33")&&candidate.length===12)all.add("0"+candidate.slice(3));
  for(const [prefix,code] of [["590","0590"],["596","0596"],["594","0594"],["262","0262"]]){
    if(candidate.startsWith("+"+prefix))all.add(code+candidate.slice(1+prefix.length));
  }
  return [...all].filter(x=>x.length>6).slice(0,6);
}
async function findUniqueHubSpotContact(phone:string|null):Promise<{id:string;label:string}|null>{
  const inputs=possiblePhones(phone);
  if(!inputs.length)return null;
  const result=await hubspotJson("/crm/objects/2026-03/contacts/search",{
    method:"POST",
    body:JSON.stringify({
      filterGroups:inputs.slice(0,2).flatMap(value=>["phone","mobilephone"].map(propertyName=>({
        filters:[{propertyName,operator:"EQ",value}],
      }))),
      limit:5,
      properties:["firstname","lastname","email","phone","mobilephone"],
    }),
  }) as {results?:Array<{id:string;properties?:Record<string,string|null>}>};
  if(!Array.isArray(result.results)||result.results.length!==1)return null;
  const record=result.results[0];
  const p=record.properties||{};
  return {id:String(record.id),label:[p.firstname,p.lastname].filter(Boolean).join(" ")||p.email||record.id};
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const access=await requireCockpitAccess();
    if(!access.email)return NextResponse.json({error:"Une adresse e-mail Cockpit est nécessaire."},{status:403});
    const origin=request.headers.get("origin");
    if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Origine non autorisée."},{status:403});
    const {id}=await params;
    const body=await request.json().catch(()=>({}));
    const actionIndex=Number(body.actionIndex);
    const manualText=typeof body.manualText==="string"?body.manualText.trim():"";
    const when=new Date(String(body.dueAt||""));
    const type=String(body.taskType||"CALL");
    if(!Number.isInteger(actionIndex)||actionIndex<-1||actionIndex>39||!TYPES.has(type)){
      return NextResponse.json({error:"Action ou type de tâche invalide."},{status:400});
    }
    if(!Number.isFinite(when.getTime())||when.getTime()<Date.now()+30_000||when.getTime()>Date.now()+366*86400_000){
      return NextResponse.json({error:"Choisissez une échéance future, à moins d’un an."},{status:400});
    }

    const rawCall=await getAuthorizedAlloCall(id,access);
    const call=shapeWithAlloCallDetail(rawCall);
    if(call.id!==id)return NextResponse.json({error:"Appel Allo introuvable."},{status:404});
    const text=actionIndex===-1?manualText:call.actions[actionIndex]?.text||"";
    if(text.length<5||text.length>1000)return NextResponse.json({error:"Choisissez une action Allo disponible ou saisissez une action valide."},{status:400});

    const digest=createHash("sha256").update(actionIndex===-1?"manual:"+text.toLowerCase():"allo:"+text.toLowerCase()).digest("hex");
    const supabase=getSupabaseAdmin();
    const owner=access.email.toLowerCase();
    const {error:reservationError}=await supabase.from("sdr_allo_action_tasks").insert({
      call_id:id,action_fingerprint:digest,owner_email:owner,state:"pending",
    });
    if(reservationError){
      if(reservationError.code==="23505"){
        return NextResponse.json({error:"Cette action a déjà été prise en charge dans HubSpot, ou sa création est en cours."},{status:409});
      }
      throw reservationError;
    }

    let hubspotTaskConfirmed=false;
    try{
      const assignee=await resolveCockpitTaskAssignee(owner);
      // An ambiguous CRM match never creates a wrong association.
      const contact=await findUniqueHubSpotContact(call.contactNumber).catch(()=>null);
      const properties:Record<string,string>={
        hs_task_subject:(actionIndex>=0?"Action Allo — ":"Suivi après appel — ")+text.slice(0,125),
        hs_task_body:[
          "Action confirmée par le SDR dans Gando à partir d'un appel Allo.",
          "Action : "+text,
          call.contactName?"Interlocuteur : "+call.contactName:"",
          call.contactNumber?"Téléphone : "+call.contactNumber:"",
          "Appel source : https://room.gando.pro/phone?call="+encodeURIComponent(id),
          "Compte rendu : "+(call.summary||"Non fourni par Allo").slice(0,1400),
        ].filter(Boolean).join("\n"),
        hs_task_status:"NOT_STARTED",
        hs_task_priority:"HIGH",
        hs_task_type:type,
        hs_timestamp:when.toISOString(),
      };
      if(assignee?.hubspotOwnerId)properties.hubspot_owner_id=assignee.hubspotOwnerId;
      const created=await createTask(properties,contact?[{id:contact.id,associationTypeId:204}]:[]);
      hubspotTaskConfirmed=true;
      const taskId=String(created.id||"");
      if(!taskId)throw new Error("HubSpot n'a pas confirmé l'identifiant de la tâche.");
      const {error:updateError}=await supabase.from("sdr_allo_action_tasks")
        .update({state:"created",hubspot_task_id:taskId,updated_at:new Date().toISOString()})
        .eq("call_id",id).eq("action_fingerprint",digest).eq("owner_email",owner);
      if(updateError)console.error("SDR task record confirmation:",updateError.message);
      if(assignee)await saveCockpitTaskAssignee(taskId,owner).catch(err=>console.warn("Cockpit task assignee sync",err));
      return NextResponse.json({
        created:true,hubspotTaskId:taskId,contactLinked:contact?.label||null,action:text,
      },{status:201,headers:{"Cache-Control":"private, no-store"}});
    }catch(error){
      // Release reservation if no task creation was confirmed.
      const {data:row}=await supabase.from("sdr_allo_action_tasks")
        .select("state").eq("call_id",id).eq("action_fingerprint",digest).eq("owner_email",owner).maybeSingle();
      if(row?.state==="pending" && !hubspotTaskConfirmed){
        await supabase.from("sdr_allo_action_tasks")
          .delete().eq("call_id",id).eq("action_fingerprint",digest).eq("owner_email",owner);
      }
      throw error;
    }
  }catch(error){
    const raw=Number((error as {status?:number}).status||502);
    const status=[400,401,403,404,409,429,503].includes(raw)?raw:502;
    return NextResponse.json({error:error instanceof Error?error.message:"Impossible de créer la tâche de suivi."},{status,headers:{"Cache-Control":"private, no-store"}});
  }
}
