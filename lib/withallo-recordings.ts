import "server-only";
import { withAlloRequest, WithAlloError, listWithAlloUserEmails } from "@/lib/withallo";
import type { CockpitAccess } from "@/lib/cockpit-access";

// Recording links never leave this server module. Allo's download API returns
// short-lived bearer URLs; they must not be included in a JSON response.
const CALL_ID = /^cll[-_][a-zA-Z0-9_-]{3,120}$/;

type AlloCallDetail = {
  id?: string;
  type?: string;
  recording_url?: string | null;
  recording_download_url?: string | null;
  recording_duration?: number | null;
  user_email?: string | null;
  user?: { email?: string | null; id?: string | null } | null;
};

function safeCallId(id: string) {
  if (!CALL_ID.test(id)) throw new WithAlloError("Identifiant d'appel Allo invalide.", 400);
  return id;
}

export async function getAuthorizedAlloCall(id: string, access: CockpitAccess): Promise<AlloCallDetail> {
  const callId = safeCallId(id);
  const response = await withAlloRequest<{ data?: AlloCallDetail }>(
    "/v2/api/conversations/items/" + encodeURIComponent(callId),
  );
  const call = response.data;
  if (!call || call.id !== callId || (call.type && call.type !== "CALL")) {
    throw new WithAlloError("Appel introuvable.", 404);
  }
  // Do not expose the team-wide Allo service key's recordings to other reps.
  let userEmail = String(call.user?.email || call.user_email || "").trim().toLowerCase();
  // Some Allo API versions omit user.email on the item but include user.id.
  // Only resolve the ID with the official team roster; never trust caller input.
  if (!userEmail && call.user?.id && access.role !== "admin") {
    const users = await listWithAlloUserEmails().catch(() => new Map<string, string>());
    userEmail = users.get(call.user.id) || "";
  }
  if (access.role !== "admin" && (!access.email || userEmail !== access.email.trim().toLowerCase())) {
    throw new WithAlloError("Cet enregistrement est réservé au commercial concerné.", 403);
  }
  return call;
}

export async function getAuthorizedAlloRecordingLink(id: string, access: CockpitAccess): Promise<URL> {
  const call = await getAuthorizedAlloCall(id, access);
  // Only request/download recordings known to exist on the line.
  if (call.recording_url === null && call.recording_download_url === null &&
      !(Number(call.recording_duration) > 0)) {
    throw new WithAlloError("Cet appel ne possède aucun enregistrement. Vérifiez que l'enregistrement est activé dans Allo.", 404);
  }
  const response = await withAlloRequest<{ data?: { url?: string; expires_at?: string } }>(
    "/v2/api/conversations/items/" + encodeURIComponent(id) + "/recording",
  );
  const raw = response.data?.url;
  if (!raw || typeof raw !== "string") throw new WithAlloError("Allo n'a pas fourni de lien d'enregistrement.", 404);
  let url: URL;
  try { url = new URL(raw); } catch { throw new WithAlloError("Lien audio invalide.", 502); }
  // No redirects and no arbitrary origin: avoids SSRF and leaking bearer URLs.
  if (url.protocol !== "https:" || url.hostname !== "storage.withallo.com" ||
      url.port || !url.pathname.startsWith("/object/sign/recordings/")) {
    throw new WithAlloError("Domaine audio Allo inattendu. Contactez le support pour autoriser ce stockage.", 502);
  }
  return url;
}
