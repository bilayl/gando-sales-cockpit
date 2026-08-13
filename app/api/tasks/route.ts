import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/hubspot";
import { createTask, searchTasks } from "@/lib/hubspot/tasks";

const TASK_TYPES = new Set(["CALL", "EMAIL", "MEETING", "TODO", "LINKED_IN", "LINKED_IN_CONNECT", "LINKED_IN_MESSAGE"]);
const TASK_PRIORITIES = new Set(["NONE", "LOW", "MEDIUM", "HIGH"]);

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const period = p.get("period") || "today";
    const allowedPeriods = new Set(["all", "today", "overdue", "upcoming", "completed"]);
    return NextResponse.json(await searchTasks({
      period: (allowedPeriods.has(period) ? period : "today") as "all" | "today" | "overdue" | "upcoming" | "completed",
      type: p.get("type")?.trim() || undefined,
      owner: p.get("owner")?.trim() || undefined,
      after: p.get("after")?.trim() || undefined,
      query: p.get("q")?.trim() || undefined,
    }));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subject = String(body.subject || "").trim();
    const timestamp = new Date(String(body.timestamp || ""));
    const type = String(body.type || "TODO");
    const priority = String(body.priority || "NONE");
    if (!subject) return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });
    if (Number.isNaN(timestamp.getTime())) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    if (!TASK_TYPES.has(type) || !TASK_PRIORITIES.has(priority)) return NextResponse.json({ error: "Type ou priorité invalide" }, { status: 400 });
    const properties: Record<string, string> = {
      hs_task_subject: subject,
      hs_task_body: String(body.body || "").trim(),
      hs_timestamp: timestamp.toISOString(),
      hs_task_status: "NOT_STARTED",
      hs_task_priority: priority,
      hs_task_type: type,
    };
    if (body.ownerId) properties.hubspot_owner_id = String(body.ownerId);
    return NextResponse.json(await createTask(properties), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
