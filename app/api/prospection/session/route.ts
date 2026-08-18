import { NextRequest, NextResponse } from "next/server";
import { hubspotJson } from "@/lib/hubspot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TASK_PROPERTIES = [
  "hs_task_subject",
  "hs_task_body",
  "hs_task_status",
  "hs_task_priority",
  "hs_task_type",
  "hs_timestamp",
  "hubspot_owner_id",
];

const CONTACT_PROPERTIES = ["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle"];

type AssociationMap = Map<string, string[]>;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function batchAssociations(fromType: string, toType: string, ids: string[]): Promise<AssociationMap> {
  const result = new Map<string, string[]>();
  const distinct = unique(ids);
  for (let index = 0; index < distinct.length; index += 100) {
    const chunk = distinct.slice(index, index + 100);
    if (!chunk.length) continue;
    const data = await hubspotJson(`/crm/associations/2026-03/${fromType}/${toType}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ inputs: chunk.map(id => ({ id })) }),
    });
    for (const row of data.results || []) {
      const fromId = String(row.from?.id || row.fromObjectId || "");
      const targets = (row.to || []).map((target: any) => String(target.toObjectId || target.id || "")).filter(Boolean);
      if (fromId) result.set(fromId, targets);
    }
  }
  return result;
}

async function batchRead(path: string, ids: string[], properties: string[]) {
  const rows: any[] = [];
  const distinct = unique(ids);
  for (let index = 0; index < distinct.length; index += 100) {
    const chunk = distinct.slice(index, index + 100);
    if (!chunk.length) continue;
    const data = await hubspotJson(`/crm/objects/2026-03/${path}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties, inputs: chunk.map(id => ({ id })) }),
    });
    rows.push(...(data.results || []));
  }
  return rows;
}

function contactLabel(contact: any) {
  const p = contact?.properties || {};
  return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || p.phone || p.mobilephone || "Contact";
}

function dueAt(task: any) {
  const value = task?.properties?.hs_timestamp;
  const timestamp = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyIds = unique((Array.isArray(body.companyIds) ? body.companyIds : []).map(String)).slice(0, 100);
    if (!companyIds.length) return NextResponse.json({ summaries: {} });

    const [companyContacts, companyTasks] = await Promise.all([
      batchAssociations("companies", "contacts", companyIds),
      batchAssociations("companies", "tasks", companyIds),
    ]);

    const contactIds = unique([...companyContacts.values()].flat());
    const contactTasks = await batchAssociations("contacts", "tasks", contactIds);
    const allTaskIds = unique([
      ...[...companyTasks.values()].flat(),
      ...[...contactTasks.values()].flat(),
    ]);

    const [tasks, contacts] = await Promise.all([
      batchRead("tasks", allTaskIds, TASK_PROPERTIES),
      batchRead("contacts", contactIds, CONTACT_PROPERTIES),
    ]);

    const taskById = new Map(tasks.map(task => [String(task.id), task]));
    const contactById = new Map(contacts.map(contact => [String(contact.id), contact]));
    const now = Date.now();
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    const endTodayMs = endToday.getTime();

    const summaries: Record<string, any> = {};

    for (const companyId of companyIds) {
      const directTaskIds = companyTasks.get(companyId) || [];
      const associatedContactIds = companyContacts.get(companyId) || [];
      const taskSources = new Map<string, string | null>();

      for (const taskId of directTaskIds) taskSources.set(taskId, null);
      for (const contactId of associatedContactIds) {
        for (const taskId of contactTasks.get(contactId) || []) {
          if (!taskSources.has(taskId)) taskSources.set(taskId, contactId);
        }
      }

      const openTasks = [...taskSources.entries()]
        .map(([taskId, sourceContactId]) => {
          const task = taskById.get(taskId);
          if (!task || String(task.properties?.hs_task_status || "") === "COMPLETED") return null;
          const due = dueAt(task);
          const contact = sourceContactId ? contactById.get(sourceContactId) : null;
          const p = contact?.properties || {};
          return {
            id: String(task.id),
            subject: task.properties?.hs_task_subject || "Tâche HubSpot",
            status: task.properties?.hs_task_status || "NOT_STARTED",
            priority: task.properties?.hs_task_priority || null,
            type: task.properties?.hs_task_type || null,
            dueAt: due === Number.MAX_SAFE_INTEGER ? null : new Date(due).toISOString(),
            sourceContactId,
            sourceContactName: contact ? contactLabel(contact) : null,
            sourceContactPhone: contact ? (p.phone || p.mobilephone || null) : null,
            sourceContactJobTitle: contact ? (p.jobtitle || null) : null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
          const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
          if (aDue !== bDue) return aDue - bDue;
          return String(a.priority || "").toUpperCase() === "HIGH" ? -1 : 1;
        });

      const overdueTaskCount = openTasks.filter((task: any) => task.dueAt && Date.parse(task.dueAt) < now).length;
      const todayTaskCount = openTasks.filter((task: any) => {
        if (!task.dueAt) return false;
        const timestamp = Date.parse(task.dueAt);
        return timestamp >= now && timestamp <= endTodayMs;
      }).length;

      summaries[companyId] = {
        openTaskCount: openTasks.length,
        overdueTaskCount,
        todayTaskCount,
        nextTask: openTasks[0] || null,
      };
    }

    return NextResponse.json({ summaries }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const e = error as Error & { status?: number };
    return NextResponse.json({ error: e.message || "Impossible de préparer la session de prospection" }, { status: e.status || 500 });
  }
}
