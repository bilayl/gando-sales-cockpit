import "server-only";

import { getCockpitSession } from "@/lib/auth";

function cleanIdentity(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function requireSDInternalAccess() {
  const session = await getCockpitSession();
  if (!session) {
    throw Object.assign(new Error("Reconnectez-vous au Sales Cockpit pour continuer."), { status: 401 });
  }

  return cleanIdentity(session.email) || String(session.displayName || "").trim() || "équipe Gando";
}
