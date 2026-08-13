import { hubspotJson } from "@/lib/hubspot";

export const TASK_PROPERTIES = [
  "hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status",
  "hs_task_priority", "hs_task_type", "hubspot_owner_id", "hs_createdate",
];

type AssociationInput = { id: string; associationTypeId: number };

export type TaskFilters = {
  period?: "all" | "today" | "overdue" | "upcoming" | "completed";
  type?: string;
  owner?: string;
  after?: string;
  query?: string;
};

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function taskFilters(filters: TaskFilters) {
  const now = new Date();
  const rows: Array<Record<string, unknown>> = [];
  if (filters.owner) rows.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: filters.owner });
  if (filters.type) rows.push({ propertyName: "hs_task_type", operator: "EQ", value: filters.type });

  switch (filters.period) {
    case "today":
      rows.push({ propertyName: "hs_timestamp", operator: "GTE", value: startOfDay(now).toISOString() });
      rows.push({ propertyName: "hs_timestamp", operator: "LTE", value: endOfDay(now).toISOString() });
      rows.push({ propertyName: "hs_task_status", operator: "NOT_IN", values: ["COMPLETED"] });
      break;
    case "overdue":
      rows.push({ propertyName: "hs_timestamp", operator: "LT", value: startOfDay(now).toISOString() });
      rows.push({ propertyName: "hs_task_status", operator: "NOT_IN", values: ["COMPLETED"] });
      break;
    case "upcoming":
      rows.push({ propertyName: "hs_timestamp", operator: "GT", value: endOfDay(now).toISOString() });
      rows.push({ propertyName: "hs_task_status", operator: "NOT_IN", values: ["COMPLETED"] });
      break;
    case "completed":
      rows.push({ propertyName: "hs_task_status", operator: "EQ", value: "COMPLETED" });
      break;
    default:
      break;
  }
  return rows;
}

async function batchAssociations(ids: string[], toType: "contacts" | "companies" | "deals") {
  if (!ids.length) return new Map<string, string[]>();
  try {
    const data = await hubspotJson(`/crm/associations/2026-03/tasks/${toType}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ inputs: ids.map(id => ({ id })) }),
    });
    return new Map<string, string[]>((data.results || []).map((row: any) => [
      String(row.from?.id || row.fromObjectId || ""),
      (row.to || []).map((target: any) => String(target.toObjectId || target.id || "")).filter(Boolean),
    ]));
  } catch {
    return new Map<string, string[]>();
  }
}

async function batchRead(type: "contacts" | "companies" | "deals", ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const properties = type === "contacts"
    ? ["firstname", "lastname", "email", "phone", "mobilephone", "company"]
    : type === "companies" ? ["name", "domain"] : ["dealname", "dealstage"];
  const data = await hubspotJson(`/crm/objects/2026-03/${type}/batch/read`, {
    method: "POST",
    body: JSON.stringify({ properties, inputs: ids.map(id => ({ id })) }),
  });
  return new Map<string, any>((data.results || []).map((row: any) => [String(row.id), row]));
}

async function enrichTasks(tasks: any[]) {
  const ids = tasks.map(task => String(task.id));
  const [contactLinks, companyLinks, dealLinks] = await Promise.all([
    batchAssociations(ids, "contacts"),
    batchAssociations(ids, "companies"),
    batchAssociations(ids, "deals"),
  ]);
  const contactIds = [...new Set([...contactLinks.values()].flat())];
  const companyIds = [...new Set([...companyLinks.values()].flat())];
  const dealIds = [...new Set([...dealLinks.values()].flat())];
  const [contacts, companies, deals] = await Promise.all([
    batchRead("contacts", contactIds),
    batchRead("companies", companyIds),
    batchRead("deals", dealIds),
  ]);
  return tasks.map(task => {
    const taskId = String(task.id);
    return {
      ...task,
      associations: {
        contact: contacts.get(contactLinks.get(taskId)?.[0] || "") || null,
        company: companies.get(companyLinks.get(taskId)?.[0] || "") || null,
        deal: deals.get(dealLinks.get(taskId)?.[0] || "") || null,
      },
    };
  });
}

export async function searchTasks(filters: TaskFilters = {}) {
  const body: Record<string, unknown> = {
    limit: 100,
    properties: TASK_PROPERTIES,
    sorts: [{ propertyName: "hs_timestamp", direction: "ASCENDING" }],
  };
  const selectedFilters = taskFilters(filters);
  if (selectedFilters.length) body.filterGroups = [{ filters: selectedFilters }];
  if (filters.after) body.after = filters.after;
  if (filters.query) body.query = filters.query;
  const data = await hubspotJson("/crm/objects/2026-03/tasks/search", { method: "POST", body: JSON.stringify(body) });
  return { ...data, results: await enrichTasks(data.results || []) };
}

export async function countOpenTasksThrough(end: Date, owner?: string) {
  const filters: Array<Record<string, unknown>> = [
    { propertyName: "hs_timestamp", operator: "LTE", value: end.toISOString() },
    { propertyName: "hs_task_status", operator: "NOT_IN", values: ["COMPLETED"] },
  ];
  if (owner) filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: owner });
  const data = await hubspotJson("/crm/objects/2026-03/tasks/search", {
    method: "POST",
    body: JSON.stringify({ limit: 1, properties: ["hs_timestamp"], filterGroups: [{ filters }] }),
  });
  return Number(data.total || 0);
}

export async function createTask(properties: Record<string, string>, associations: AssociationInput[] = []) {
  return hubspotJson("/crm/objects/2026-03/tasks", {
    method: "POST",
    body: JSON.stringify({
      properties,
      associations: associations.map(association => ({
        to: { id: association.id },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: association.associationTypeId }],
      })),
    }),
  });
}

export async function createReminderTask(contact: any, reminderAt: Date) {
  const p = contact.properties || {};
  const contactName = [p.firstname, p.lastname].filter(Boolean).join(" ") || "Contact";
  const companyName = p.company || "Entreprise";
  const companyId = contact.associations?.companies?.results?.[0]?.id;
  const dealId = contact.associations?.deals?.results?.[0]?.id;
  const associations: AssociationInput[] = [{ id: String(contact.id), associationTypeId: 204 }];
  if (companyId) associations.push({ id: String(companyId), associationTypeId: 192 });
  if (dealId) associations.push({ id: String(dealId), associationTypeId: 216 });

  const properties: Record<string, string> = {
    hs_task_subject: `Rappeler — ${companyName} — ${contactName}`,
    hs_task_body: "Rappel planifié depuis Gando Sales Cockpit.",
    hs_timestamp: reminderAt.toISOString(),
    hs_task_status: "NOT_STARTED",
    hs_task_priority: "HIGH",
    hs_task_type: "CALL",
  };
  if (p.hubspot_owner_id) properties.hubspot_owner_id = String(p.hubspot_owner_id);
  return createTask(properties, associations);
}

export async function updateTaskStatus(taskId: string, status: string) {
  const allowed = new Set(["COMPLETED", "DEFERRED", "IN_PROGRESS", "NOT_STARTED", "WAITING"]);
  if (!allowed.has(status)) throw new Error("Statut de tâche invalide");
  return hubspotJson(`/crm/objects/2026-03/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { hs_task_status: status } }),
  });
}
