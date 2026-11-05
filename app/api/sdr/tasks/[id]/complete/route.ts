import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { resolveCockpitTaskAssignee } from "@/lib/cockpit-task-assignment";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hubspotJson } from "@/lib/hubspot";
import { updateTaskStatus } from "@/lib/hubspot/tasks";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try {
    const access=await requireCockpitAccess();
    const {id}=await params;
    if(!/^\d+$/.test(id))return NextResponse.json({error:"Identifiant de tâche invalide."},{status:400});
    const origin=request.headers.get("origin");
    if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Origine invalide."},{status:403});
    const task=await hubspotJson("/crm/objects/2026-03/tasks/"+encodeURIComponent(id)+"?properties=hubspot_owner_id,hs_task_status") as {id:string;properties?:{hubspot_owner_id?:string}};
    if(access.role!=="admin"){
      if(!access.email)return NextResponse.json({error:"Aucune identité Cockpit."},{status:403});
      const user=await resolveCockpitTaskAssignee(access.email);
      const {data:local}=await getSupabaseAdmin().from("tasks").select("assignee_cockpit_email").eq("hubspot_id",id).maybeSingle();
      const owner=String(task.properties?.hubspot_owner_id||"");
      const localEmail=String(local?.assignee_cockpit_email||"").trim().toLowerCase();
      if(localEmail!==access.email.toLowerCase() && (!user?.hubspotOwnerId||user.hubspotOwnerId!==owner)){
        return NextResponse.json({error:"Cette tâche n’est pas affectée à votre compte."},{status:403});
      }
    }
    const updated=await updateTaskStatus(id,"COMPLETED");
    return NextResponse.json({ok:true,id:String(updated.id||id)},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const raw=Number((error as {status?:number}).status||502);
    const status=[400,401,403,404,429,503].includes(raw)?raw:502;
    return NextResponse.json({error:error instanceof Error?error.message:"Échec de la mise à jour de la tâche."},{status});
  }
}
