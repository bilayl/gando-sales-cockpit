import { NextRequest, NextResponse } from "next/server";
import { apiError, hubspotJson } from "@/lib/hubspot";
import { resolveCockpitTaskAssignee, saveCockpitTaskAssignee } from "@/lib/cockpit-task-assignment";

const TASK_STATUSES = new Set(["COMPLETED", "DEFERRED", "IN_PROGRESS", "NOT_STARTED", "WAITING"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const properties: Record<string, string> = {};
    let cockpitAssignee = undefined as Awaited<ReturnType<typeof resolveCockpitTaskAssignee>> | undefined;

    if (body.status !== undefined) {
      const status = String(body.status || "");
      if (!TASK_STATUSES.has(status)) return NextResponse.json({ error: "Statut de tâche invalide" }, { status: 400 });
      properties.hs_task_status = status;
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

    return NextResponse.json({ ...updated, cockpitAssignee: cockpitAssignee ?? undefined });
  } catch (error) {
    return apiError(error);
  }
}
