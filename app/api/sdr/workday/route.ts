import { NextRequest, NextResponse } from "next/server";
import { requireCockpitAccess } from "@/lib/cockpit-access";
import { epochBounds, getCallAnalyticsRange } from "@/lib/call-analytics-period";
import { searchTasks } from "@/lib/hubspot/tasks";
import { enrichTasksWithCockpitAssignees, listActiveCockpitTaskAssignees } from "@/lib/cockpit-task-assignment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const access = await requireCockpitAccess();
    if(!access.email)return NextResponse.json({error:"Adresse e-mail Gando requise."},{status:403});
    const team = request.nextUrl.searchParams.get("scope")==="team" && access.role==="admin";
    const date = getCallAnalyticsRange("today");
    const bounds = epochBounds(date.from,date.to);
    const roster = await listActiveCockpitTaskAssignees();
    const me = roster.find(person => person.email.toLowerCase()===access.email?.toLowerCase());
    if(!team && !me) return NextResponse.json({tasks:[],stats:{overdue:0,today:0},partial:false,canViewTeam:access.role==="admin",source:"HubSpot",notice:"Votre compte n’est pas attribué aux tâches commerciales."});

    const tasks: any[] = [];
    let after: string|undefined;
    let partial = false;
    // Paginate, rather than relying on only the first page of company tasks.
    for(let i=0;i<4;i++){
      const page = await searchTasks({period:"all",after});
      tasks.push(...(page.results||[]));
      after=page.paging?.next?.after;
      if(!after)break;
      if(i===3)partial=true;
    }
    const enriched=await enrichTasksWithCockpitAssignees(tasks,roster);
    const included=enriched.filter(task=>{
      if(String(task.properties?.hs_task_status||"")==="COMPLETED")return false;
      const timestamp=Date.parse(String(task.properties?.hs_timestamp||""));
      if(!Number.isFinite(timestamp) || timestamp>=bounds.toExclusive)return false;
      if(team)return true;
      const email=String(task.cockpitAssignee?.email||"").toLowerCase();
      const owner=String(task.properties?.hubspot_owner_id||"");
      return email===access.email?.toLowerCase() || (Boolean(me?.hubspotOwnerId) && owner===me?.hubspotOwnerId);
    }).sort((a,b)=>Date.parse(String(a.properties?.hs_timestamp||""))-Date.parse(String(b.properties?.hs_timestamp||"")));
    const rows=included.slice(0,120).map(task=>{
      const p=task.properties||{};
      const contact=task.associations?.contact;
      const company=task.associations?.company;
      const cp=contact?.properties||{};
      return {
        id:String(task.id),
        subject:String(p.hs_task_subject||"Tâche"),
        body:String(p.hs_task_body||"").slice(0,500),
        dueAt:String(p.hs_timestamp||""),
        priority:String(p.hs_task_priority||"NONE"),
        type:String(p.hs_task_type||"TODO"),
        assignee:String(task.cockpitAssignee?.displayName||task.cockpitAssignee?.email||""),
        companyId:company?.id?String(company.id):null,
        companyName:company?.properties?.name||cp.company||null,
        contactId:contact?.id?String(contact.id):null,
        contactName:[cp.firstname,cp.lastname].filter(Boolean).join(" ")||cp.email||null,
        phone:cp.mobilephone||cp.phone||null,
        overdue:Date.parse(String(p.hs_timestamp||""))<bounds.from,
      };
    });
    return NextResponse.json({
      tasks:rows,
      stats:{overdue:rows.filter(t=>t.overdue).length,today:rows.filter(t=>!t.overdue).length},
      partial:partial||included.length>rows.length,source:"HubSpot",
      canViewTeam:access.role==="admin",scope:team?"team":"mine",
      notice:partial?"Plus de 400 tâches dans HubSpot : les tâches au-delà de cette limite ne sont pas incluses.":null,
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const raw=Number((error as {status?:number}).status||502);
    return NextResponse.json({error:error instanceof Error?error.message:"File de travail indisponible."},{status:[400,401,403,429,503].includes(raw)?raw:502,headers:{"Cache-Control":"private, no-store"}});
  }
}
