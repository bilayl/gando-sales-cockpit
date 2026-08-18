import { NextResponse } from "next/server";

const SUPABASE_ONOFF_URL = "https://hboentjvcxpqlyzlrebx.supabase.co/functions/v1/onoff";

function ok() {
  return NextResponse.json({ ok: true, service: "gando-onoff-relay" }, { status: 200 });
}

export async function GET() {
  return ok();
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST",
      "Access-Control-Allow-Headers": "authorization,content-type,x-api-key",
    },
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const authorization = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");

  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") || "application/json");

  if (authorization) {
    headers.set("authorization", authorization);
  } else if (xApiKey) {
    headers.set("authorization", `x-api-key ${xApiKey}`);
  }

  const response = await fetch(SUPABASE_ONOFF_URL, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const responseBody = await response.text();
  const responseHeaders = new Headers();
  responseHeaders.set("content-type", response.headers.get("content-type") || "application/json");

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
