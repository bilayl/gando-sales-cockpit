import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createGandoSalesMcpServer } from "@/lib/gando-sales-mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mcpHandler = createMcpHandler(createGandoSalesMcpServer, {
  responseMode: "json",
});

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

async function handleMcpRequest(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized MCP request" }, { status: 401 });
  }
  return mcpHandler.fetch(request);
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
