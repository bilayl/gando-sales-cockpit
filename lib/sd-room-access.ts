import "server-only";

import { getCockpitAccess } from "@/lib/cockpit-access";

function cleanIdentity(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function requireSDInternalAccess() {
  const access = await getCockpitAccess();
  if (!access) {
    throw Object.assign(new Error("Reconnectez-vous au Sales Cockpit pour continuer."), { status: 401 });
  }
  if (!access.canAccessDealRoom) {
    throw Object.assign(new Error("Le rôle Commercial n’a pas accès à la Deal Room."), { status: 403 });
  }

  return cleanIdentity(access.email) || String(access.displayName || "").trim() || "équipe Gando";
}
