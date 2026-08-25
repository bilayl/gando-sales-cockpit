import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { resolveCockpitTaskAssignee, saveCockpitTaskAssignee } from "@/lib/cockpit-task-assignment";
import { requireCockpitAccess } from "@/lib/cockpit-access";

const TASK_STATUSES = new Set(["COMPLETED", "DEFERRED", "IN_PROGRESS", "NOT_STARTED", "WAITING"]);
const TASK_PRIORITIES = new Set(["NONE", "LOW", "MEDIUM", "HIGH"]);
const TASK_TYPES = new Set(["CALL", "EMAIL", "MEETING", "TODO", "LINKED_IN", "LINKED_IN_CONNECT", "LINKED_IN_MESSAGE"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCockpitAccess();
    const { id } = await params;
    const body = await request.json();
    const properties: Record<string, string> = {};
    let cockpitAssignee = undefined as Awaited<ReturnType<typeof resolveCockpitTaskAssignee>> | undefined;

    if (body.status !== undefined) {
      const status = String(body.status || "");
      if (!TASK_STATUSES.has(status)) return NextResponse.json({ error: "Statut de tâche invalide" }, { status: 400 });
      properties.hs_task_status = status;
    }

    if (body.subject !== undefined) {
      const subject = String(body.subject || "").trim();
      if (!subject) return NextResponse.json({ error: "Le titre de la tâche est obligatoire" }, { status: 400 });
      properties.hs_task_subject = subject.slice(0, 500);
    }

    if (body.body !== undefined) {
      properties.hs_task_body = String(body.body || "").trim().slice(0, 10000);
    }

    if (body.timestamp !== undefined) {
      const timestamp = new Date(String(body.timestamp || ""));
      if (Number.isNaN(timestamp.getTime())) return NextResponse.json({ error: "Date de tâche invalide" }, { status: 400 });
      properties.hs_timestamp = timestamp.toISOString();
    }

    if (body.priority !== undefined) {
      const priority = String(body.priority || "NONE");
      if (!TASK_PRIORITIES.has(priority)) return NextResponse.json({ error: "Priorité de tâche invalide" }, { status: 400 });
      properties.hs_task_priority = priority;
    }

    if (body.type !== undefined) {
      const type = String(body.type || "TODO");
      if (!TASK_TYPES.has(type)) return NextResponse.json({ error: "Type de tâche invalide" }, { status: 400 });
      properties.hs_task_type = type;
    }

    if (body.assigneeEmail !== undefined) {
      const email = String(body.assigneeEmail || "").trim();
      cockpitAssignee = await resolveCockpitTaskAssignee(email || null);
      if (cockpitAssignee?.hubspotOwnerId) properties.hubspot_owner_id = cockpitAssignee.hubspotOwnerId;
      else if (!cockpitAssignee) properties.hubspot_owner_id = "";
    }

    if (!Object.keys(properties).length && body.assigneeEmail === undefined) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }

    const updated = Object.keys(properties).length
      ? await hubspotJson(`/crm/objects/2026-03/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        })
      : await hubspotJson(`/crm/objects/2026-03/tasks/${encodeURIComponent(id)}?properties=hs_task_subject,hubspot_owner_id`);

    if (body.assigneeEmail !== undefined) {
      await saveCockpitTaskAssignee(id, cockpitAssignee?.email || null);
    }

    return NextResponse.json({
      ...updated,
      ...(body.assigneeEmail !== undefined ? { cockpitAssignee: cockpitAssignee || null } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
}
