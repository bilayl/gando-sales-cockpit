import { timingSafeEqual } from "node:crypto";
import {
  executeSalesAgentTool,
  OPENROUTER_SALES_TOOLS,
  SALES_AGENT_TOOL_NAMES,
  SALES_MCP_TOOL_METADATA,
  type SalesAgentToolName,
} from "@/lib/sales-agent-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVER_INFO = { name: "gando-sales-cockpit", version: "1.0.0" };
const INSTRUCTIONS = [
  "Internal commercial execution server for Gando Sales Cockpit.",
  "Use read tools to inspect real CRM data before recommending an action.",
  "Respect the contact local timezone before recommending a call.",
  "Never infer that a call happened or invent an outcome.",
  "Use write tools only after an explicit user instruction.",
].join(" ");

function authorized(request: Request) {
  const expected = process.env.GANDO_MCP_TOKEN?.trim();
  if (!expected) return false;
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function rpcResult(id: unknown, result: Record<string, unknown>, modern: boolean) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    result: modern
      ? {
          resultType: "complete",
          ...result,
          _meta: {
            ...(typeof result._meta === "object" && result._meta ? result._meta : {}),
            "io.modelcontextprotocol/serverInfo": SERVER_INFO,
          },
        }
      : result,
  });
}

function rpcError(id: unknown, code: number, message: string, status = 400) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

function isToolName(value: unknown): value is SalesAgentToolName {
  return SALES_AGENT_TOOL_NAMES.includes(String(value) as SalesAgentToolName);
}

function mcpTools() {
  return OPENROUTER_SALES_TOOLS.map(tool => {
    const name = tool.function.name as SalesAgentToolName;
    return {
      name,
      title: tool.function.description.split(".")[0],
      description: tool.function.description,
      inputSchema: tool.function.parameters,
      annotations: SALES_MCP_TOOL_METADATA[name].annotations,
    };
  });
}

async function handlePost(request: Request) {
  if (!authorized(request)) return rpcError(null, -32001, "Unauthorized MCP request", 401);

  const payload = await request.json().catch(() => null) as any;
  if (!payload || payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return rpcError(payload?.id, -32600, "Invalid JSON-RPC request");
  }

  const method = payload.method;
  const modern = request.headers.get("mcp-protocol-version") === "2026-07-28"
    || payload?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] === "2026-07-28";

  if (method === "notifications/initialized") return new Response(null, { status: 202 });

  if (method === "server/discover") {
    return rpcResult(payload.id, {
      supportedVersions: ["2026-07-28", "2025-11-25"],
      capabilities: { tools: {} },
      instructions: INSTRUCTIONS,
      ttlMs: 30_000,
      cacheScope: "private",
    }, true);
  }

  if (method === "initialize") {
    const requested = String(payload?.params?.protocolVersion || "2025-11-25");
    const protocolVersion = requested === "2026-07-28" ? "2025-11-25" : requested;
    return rpcResult(payload.id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    }, false);
  }

  if (method === "tools/list") {
    return rpcResult(payload.id, {
      tools: mcpTools(),
      ...(modern ? { ttlMs: 30_000, cacheScope: "private" } : {}),
    }, modern);
  }

  if (method === "tools/call") {
    const name = payload?.params?.name;
    if (!isToolName(name)) return rpcError(payload.id, -32602, `Unknown tool: ${String(name || "")}`);
    try {
      const result = await executeSalesAgentTool(name, payload?.params?.arguments || {}, "mcp");
      return rpcResult(payload.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      }, modern);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      return rpcResult(payload.id, {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
      }, modern);
    }
  }

  if (method === "ping") return rpcResult(payload.id, {}, modern);
  return rpcError(payload.id, -32601, `Method not found: ${method}`);
}

export async function POST(request: Request) {
  return handlePost(request);
}

export async function GET(request: Request) {
  if (!authorized(request)) return rpcError(null, -32001, "Unauthorized MCP request", 401);
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return rpcError(null, -32001, "Unauthorized MCP request", 401);
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
