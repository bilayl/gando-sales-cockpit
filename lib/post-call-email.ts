import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type PostCallEmailInput = {
  firstName?: string;
  companyName?: string;
  callTitle?: string;
  callBody?: string;
  transcription?: string;
  senderName?: string;
};

export type PostCallEmailDraft = {
  subject: string;
  body: string;
  generatedBy: "openrouter" | "fallback";
};

async function getOpenRouterApiKey() {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return envKey;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("get_server_secret", { p_name: "openrouter_api_key" });
    if (error) throw error;
    const vaultKey = typeof data === "string" ? data.trim() : "";
    if (vaultKey) return vaultKey;
  } catch {
    return "";
  }

  return "";
}

function cleanText(value?: string) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

function extractText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item?.type === "text" && typeof item.text === "string")
      .map((item: any) => item.text)
      .join("\n")
      .trim();
  }
  return "";
}

function fallbackDraft(input: PostCallEmailInput): PostCallEmailDraft {
  const firstName = cleanText(input.firstName);
  const companyName = cleanText(input.companyName);
  const senderName = cleanText(input.senderName) || "L’équipe Gando";
  const source = cleanText(input.transcription || input.callBody).slice(0, 1800);
  const subject = companyName ? `Suite à notre échange — Gando × ${companyName}` : "Suite à notre échange — Gando";
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const summary = source || "Comme convenu lors de notre échange, je vous transmets ce récapitulatif afin que vous puissiez le partager facilement en interne.";

  return {
    subject,
    body: `${greeting}\n\nMerci pour notre échange.\n\nComme convenu, voici les principaux éléments évoqués :\n${summary}\n\nSi vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible.\n\nBien à vous,\n${senderName}`,
    generatedBy: "fallback",
  };
}

export async function generatePostCallEmail(input: PostCallEmailInput): Promise<PostCallEmailDraft> {
  const source = cleanText(input.transcription || input.callBody).slice(0, 12000);
  if (!source) return fallbackDraft(input);

  const token = await getOpenRouterApiKey();
  if (!token) return fallbackDraft(input);

  const prompt = `Tu rédiges un email commercial de suivi après un appel pour Gando.app.
Le prospect a explicitement demandé un récapitulatif par email.
Rédige un email en français, naturel, professionnel, court et actionnable.
N'invente aucun fait, chiffre, promesse, tarif, prochaine étape ou document qui n'apparaît pas dans la source.
Conserve uniquement les points utiles au prospect : contexte, besoin, ce qui a été expliqué, demandes du prospect, éventuelles prochaines étapes réellement mentionnées.
Évite le jargon interne, les titres trop marketing et les formulations robotiques.
Le corps doit être en texte brut, avec des paragraphes courts et éventuellement 2 à 5 puces si cela améliore la lisibilité.

Prospect : ${cleanText(input.firstName) || "non précisé"}
Entreprise : ${cleanText(input.companyName) || "non précisée"}
Intitulé de l'appel : ${cleanText(input.callTitle) || "Appel"}
Signature : ${cleanText(input.senderName) || "L’équipe Gando"}

SOURCE ISSUE DE LA TRANSCRIPTION / NOTE :
${source}

Réponds UNIQUEMENT avec un JSON valide de forme {"subject":"...","body":"..."}.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gando.app",
        "X-Title": "Gando Sales Cockpit - Post Call Email",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_EMAIL_MODEL || process.env.OPENROUTER_MODEL || "openrouter/auto",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallbackDraft(input);
    const text = extractText(payload);
    if (!text) return fallbackDraft(input);
    const parsed = parseJson(text);
    const subject = cleanText(parsed?.subject).slice(0, 180);
    const body = cleanText(parsed?.body).slice(0, 7000);
    if (!subject || !body) return fallbackDraft(input);
    return { subject, body, generatedBy: "openrouter" };
  } catch {
    return fallbackDraft(input);
  }
}
