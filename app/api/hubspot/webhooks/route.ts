import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncContactById } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type HubSpotEvent = {
  portalId?: number;
  objectId?: number;
  subscriptionType?: string;
};

const acceptedEvents = new Set(["contact.creation", "contact.propertyChange", "contact.restore"]);
const unescapeSignatureUrl = (url: string) =>
  url.replace(/%(?:3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, code => decodeURIComponent(code));

function validHubSpotSignature(request: NextRequest, body: string) {
  const secret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");
  if (!secret || !signature || !timestamp || !/^\d{13}$/.test(timestamp)) return false;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) return false;

  // HubSpot signs the exact external callback URL (before URL decoding of reserved characters).
  const publicUrl = process.env.HUBSPOT_WEBHOOK_PUBLIC_URL?.trim() || request.url;
  const source = `POST${unescapeSignatureUrl(publicUrl)}${body}${timestamp}`;
  const expected = createHmac("sha256", secret).update(source).digest("base64");
  const lhs = Buffer.from(expected);
  const rhs = Buffer.from(signature);
  return lhs.length === rhs.length && timingSafeEqual(lhs, rhs);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!validHubSpotSignature(request, body)) {
    return NextResponse.json({ error: "Signature HubSpot invalide" }, { status: 401 });
  }

  let events: HubSpotEvent[];
  try {
    const parsed: unknown = JSON.parse(body);
    if (!Array.isArray(parsed)) throw new Error("HubSpot webhook doit être une liste");
    events = parsed as HubSpotEvent[];
  } catch {
    return NextResponse.json({ error: "Payload HubSpot invalide" }, { status: 400 });
  }

  const portalId = process.env.HUBSPOT_ACCOUNT_ID?.trim();
  const ids = [...new Set(
    events
      .filter(event => acceptedEvents.has(event.subscriptionType || ""))
      .filter(event => !portalId || String(event.portalId) === portalId)
      .map(event => String(event.objectId ?? ""))
      .filter(id => /^\d{1,25}$/.test(id)),
  )].slice(0, 100);

  const errors: string[] = [];
  let synchronized = 0;
  for (let index = 0; index < ids.length; index += 5) {
    const batch = await Promise.allSettled(ids.slice(index, index + 5).map(id => syncContactById(id)));
    for (let i = 0; i < batch.length; i++) {
      const result = batch[i];
      if (result.status === "fulfilled") synchronized++;
      else {
        console.error("HubSpot webhook contact sync failed", ids[index + i], result.reason);
        errors.push(ids[index + i]);
      }
    }
  }

  if (errors.length) return NextResponse.json({ synchronized, failed: errors.length }, { status: 503 });
  return NextResponse.json({ synchronized });
}
