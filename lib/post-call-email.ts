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

function fallbackHighlights(source: string) {
  const normalized = source
    .replace(/\bNote\s+\d+\s*[—:-][^\n]*:?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/)
    .map(item => item.trim())
    .filter(item => item.length >= 25);

  const highlights: string[] = [];
  for (const sentence of sentences) {
    const shortened = sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence;
    if (!highlights.some(existing => existing.toLowerCase() === shortened.toLowerCase())) {
      highlights.push(shortened);
    }
    if (highlights.length >= 4) break;
  }
  return highlights;
}

function fallbackDraft(input: PostCallEmailInput): PostCallEmailDraft {
  const firstName = cleanText(input.firstName);
  const companyName = cleanText(input.companyName);
  const senderName = cleanText(input.senderName) || "L’équipe Gando";
  const source = cleanText(input.transcription || input.callBody).slice(0, 2600);
  const subject = companyName ? `Suite à notre échange — Gando × ${companyName}` : "Suite à notre échange — Gando";
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const highlights = fallbackHighlights(source);
  const recap = highlights.length
    ? highlights.map(item => `- ${item}`).join("\n")
    : "- Nous avons repris les principaux éléments évoqués lors de notre échange afin de faciliter la suite de nos discussions.";

  return {
    subject,
    body: `${greeting}\n\nMerci pour notre échange.\n\nPour rappel, voici une synthèse des principaux éléments évoqués.\n\n**Points clés**\n\n${recap}\n\n**Prochaine étape**\n\nNous restons disponibles pour avancer sur les éléments convenus ensemble.\n\nSi vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible.\n\nBien à vous,\n${senderName}`,
    generatedBy: "fallback",
  };
}

export async function generatePostCallEmail(input: PostCallEmailInput): Promise<PostCallEmailDraft> {
  const source = cleanText(input.transcription || input.callBody).slice(0, 12000);
  if (!source) return fallbackDraft(input);

  const token = await getOpenRouterApiKey();
  if (!token) return fallbackDraft(input);

  const prompt = `Tu es l'assistant commercial de Gando.app et tu rédiges un email de suivi après un appel ou un rendez-vous.

OBJECTIF
Transformer la transcription ou les notes HubSpot en un email réellement rédigé, synthétique, professionnel et immédiatement envoyable. Tu ne dois JAMAIS recopier les notes brutes ni conserver des blocs du type "Note 1", "Note 2", horodatages, noms d'auteurs de notes ou compte-rendus internes.

STYLE DE RÉFÉRENCE
- Français naturel, professionnel, chaleureux et précis.
- Email aéré : paragraphes courts et une ligne vide entre chaque bloc.
- Commencer directement par "Bonjour Prénom," puis une courte phrase de contexte.
- Regrouper les informations par 2 à 5 sections maximum lorsque cela améliore la lecture.
- Les intitulés de sections doivent être sobres et pertinents, par exemple : **Intégration et passage en production**, **Points clés**, **Communication auprès des loueurs**, **Prochaines étapes**.
- Utiliser le Markdown **texte important** pour mettre en gras uniquement les décisions, validations, chiffres, contraintes, livrables ou prochaines étapes qui méritent réellement d'être mises en avant.
- Utiliser quelques puces seulement lorsqu'elles rendent une liste plus lisible.
- Ne pas surcharger l'email de gras, de titres ou de puces.
- Ne jamais utiliser de tableau.
- Terminer naturellement par : "Si vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible." puis la formule de politesse et la signature.

RÈGLES DE SYNTHÈSE
- Fusionner les informations répétées provenant de plusieurs notes ou appels.
- Donner la priorité aux informations les plus récentes lorsqu'une information a évolué.
- Faire ressortir ce qui a été validé, les points de vigilance et qui doit faire quoi ensuite.
- Reformuler les phrases télégraphiques des notes en phrases professionnelles complètes.
- Supprimer les détails internes inutiles au destinataire.
- Ne pas écrire "pour rappel, voici les éléments évoqués : Note 1...".
- Ne jamais inventer un fait, chiffre, tarif, engagement, document, date ou prochaine étape absent de la source.
- Si une prochaine étape n'est pas clairement présente, ne pas en inventer une : terminer simplement en restant disponible.

Prospect : ${cleanText(input.firstName) || "non précisé"}
Entreprise : ${cleanText(input.companyName) || "non précisée"}
Intitulé de l'appel : ${cleanText(input.callTitle) || "Appel"}
Signature : ${cleanText(input.senderName) || "L’équipe Gando"}

SOURCE ISSUE DE LA TRANSCRIPTION / DES NOTES HUBSPOT :
${source}

Réponds UNIQUEMENT avec un JSON valide de forme {"subject":"...","body":"..."}.
Le champ body doit contenir le texte complet de l'email avec les sauts de ligne et le Markdown **gras** là où il est utile.`;

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
        temperature: 0.35,
        max_tokens: 1400,
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
    const body = cleanText(parsed?.body).slice(0, 9000);
    if (!subject || !body) return fallbackDraft(input);
    return { subject, body, generatedBy: "openrouter" };
  } catch {
    return fallbackDraft(input);
  }
}
