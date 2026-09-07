import "server-only";

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { executeSalesAgentTool, SALES_MCP_TOOL_METADATA } from "@/lib/sales-agent-tools";

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function createGandoSalesMcpServer() {
  const server = new McpServer(
    { name: "gando-sales-cockpit", version: "1.0.0" },
    {
      instructions: [
        "Internal commercial execution server for Gando Sales Cockpit.",
        "Use read tools to inspect the real CRM and determine the next commercial action.",
        "Never infer that a call happened or invent an outcome.",
        "Use write tools only when the user explicitly asks to schedule a reminder or gives a real call outcome.",
        "Respect the local timezone returned by get_best_call_time before recommending a call.",
      ].join(" "),
    },
  );

  server.registerTool(
    "get_today_sales_queue",
    {
      title: "Get today's sales call queue",
      description: "Return prioritized actionable contacts, enriched with local-time call suitability.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(80).default(20),
        owner: z.string().trim().optional(),
      }),
      annotations: SALES_MCP_TOOL_METADATA.get_today_sales_queue.annotations,
    },
    async input => textResult(await executeSalesAgentTool("get_today_sales_queue", input)),
  );

  server.registerTool(
    "get_contact_context",
    {
      title: "Get contact sales context",
      description: "Load the current HubSpot contact context, recommendation and local call timing.",
      inputSchema: z.object({ contactId: z.string().trim().min(1) }),
      annotations: SALES_MCP_TOOL_METADATA.get_contact_context.annotations,
    },
    async input => textResult(await executeSalesAgentTool("get_contact_context", input)),
  );

  server.registerTool(
    "get_best_call_time",
    {
      title: "Get best call time",
      description: "Check the contact's local timezone and whether the current moment is appropriate for a sales call.",
      inputSchema: z.object({ contactId: z.string().trim().min(1) }),
      annotations: SALES_MCP_TOOL_METADATA.get_best_call_time.annotations,
    },
    async input => textResult(await executeSalesAgentTool("get_best_call_time", input)),
  );

  server.registerTool(
    "schedule_call_reminder",
    {
      title: "Schedule a HubSpot call reminder",
      description: "Create a HubSpot call reminder for an explicit future time. Only use after a direct user instruction.",
      inputSchema: z.object({
        contactId: z.string().trim().min(1),
        reminderAt: z.string().trim().min(1),
      }),
      annotations: SALES_MCP_TOOL_METADATA.schedule_call_reminder.annotations,
    },
    async input => textResult(await executeSalesAgentTool("schedule_call_reminder", input, "mcp")),
  );

  server.registerTool(
    "record_call_outcome",
    {
      title: "Record a real call outcome",
      description: "Update HubSpot with a real call outcome supplied by the user. Never infer or invent an outcome.",
      inputSchema: z.object({
        contactId: z.string().trim().min(1),
        outcome: z.enum(["NRP", "Occupé", "À rappeler", "Intéressé", "RDV pris", "Pas intéressé", "Hors cible", "Numéro invalide", "A une date ultérieure", "Intéressé mais"]),
        reminderAt: z.string().trim().optional(),
      }),
      annotations: SALES_MCP_TOOL_METADATA.record_call_outcome.annotations,
    },
    async input => textResult(await executeSalesAgentTool("record_call_outcome", input, "mcp")),
  );

  return server;
}
