import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST_CALL_EMAIL_LABELS, type PostCallEmailKind } from "@/lib/post-call-email-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type PostCallEmailInput = {
  firstName?: string;
  companyName?: string;
  callTitle?: string;
  callBody?: string;
  transcription?: string;
  senderName?: string;
  kind?: PostCallEmailKind;
};

export type PostCallEmailDraft = {
  subject: string;
  body: string;
  generatedBy: "openrouter" | "fallback";
  kind: PostCallEmailKind;
};

const EMAIL_GOALS: Record<PostCallEmailKind, string> = {
  post_demo: "Relance après une démonstration déjà réalisée. Faire avancer naturellement vers une décision ou une prochaine étape, sans pression et sans inventer de prochaine étape.",
  pricing_info: "Envoyer les informations commerciales et les éléments de tarification demandés. Reprendre uniquement les montants, frais, offres ou conditions réellement présents dans la source. Si aucun tarif précis n'est disponible, ne jamais en inventer.",
  decision_maker_intro: "Premier contact destiné au gérant, dirigeant ou décisionnaire après un échange avec l'accueil ou un membre de l'équipe. Expliquer brièvement la raison du contact et l'intérêt potentiel de Gando, sans prétendre avoir déjà parlé au décisionnaire.",
  recap: "Récapitulatif de suivi après l'appel, fidèle aux éléments réellement évoqués et centré sur les décisions, points importants et prochaines actions réellement convenues.",
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
    .replace(/\b(?:Note|Note principale|Note de contexte|Compte-rendu de l'appel)\b[^\n]*:?/gi, " ")
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
    if (!highlights.some(existing => existing.toLowerCase() === shortened.toLowerCase())) highlights.push(shortened);
    if (highlights.length >= 4) break;
  }
  return highlights;
}

function fallbackDraft(input: PostCallEmailInput): PostCallEmailDraft {
  const kind = input.kind || "recap";
  const firstName = cleanText(input.firstName);
  const companyName = cleanText(input.companyName);
  const senderName = cleanText(input.senderName) || "L’équipe Gando";
  const source = cleanText(input.transcription || input.callBody).slice(0, 2600);
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const highlights = fallbackHighlights(source);
  const recap = highlights.length
    ? highlights.map(item => `- ${item}`).join("\n")
    : "- Nous avons repris les principaux éléments évoqués lors de notre échange afin de faciliter la suite de nos discussions.";

  const subjectByKind: Record<PostCallEmailKind, string> = {
    post_demo: companyName ? `Suite à notre démonstration — Gando × ${companyName}` : "Suite à notre démonstration — Gando",
    pricing_info: companyName ? `Informations et tarifs Gando — ${companyName}` : "Informations et tarifs Gando",
    decision_maker_intro: companyName ? `Présentation de Gando — ${companyName}` : "Présentation de Gando",
    recap: companyName ? `Suite à notre échange — Gando × ${companyName}` : "Suite à notre échange — Gando",
  };

  const introByKind: Record<PostCallEmailKind, string> = {
    post_demo: "Merci pour le temps accordé lors de la démonstration de Gando.",
    pricing_info: "Comme convenu, je vous transmets une synthèse des éléments commerciaux évoqués concernant Gando.",
    decision_maker_intro: "Suite à un échange avec votre équipe, je me permets de vous contacter au sujet de Gando.",
    recap: "Merci pour notre échange. Pour rappel, voici une synthèse des principaux éléments évoqués.",
  };

  return {
    kind,
    subject: subjectByKind[kind],
    body: `${greeting}\n\n${introByKind[kind]}\n\n**Points clés**\n\n${recap}\n\nSi vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible.\n\nBien à vous,\n${senderName}`,
    generatedBy: "fallback",
  };
}

export async function generatePostCallEmail(input: PostCallEmailInput): Promise<PostCallEmailDraft> {
  const kind = input.kind || "recap";
  const source = cleanText(input.transcription || input.callBody).slice(0, 12000);
  if (!source) return fallbackDraft({ ...input, kind });

  const token = await getOpenRouterApiKey();
  if (!token) return fallbackDraft({ ...input, kind });

  const prompt = `Tu es l'assistant commercial de Gando.app et tu rédiges un email professionnel destiné à un prospect ou client.

TYPE D'EMAIL
${POST_CALL_EMAIL_LABELS[kind]}

OBJECTIF MÉTIER
${EMAIL_GOALS[kind]}

OBJECTIF DE RÉDACTION
Transformer la transcription et les notes HubSpot en un véritable email rédigé, synthétique, professionnel et immédiatement envoyable. Tu ne dois JAMAIS recopier les notes brutes ni conserver des blocs du type "Note 1", "Note 2", "Note principale", "Note de contexte", horodatages, noms d'auteurs ou compte-rendus internes.

STYLE DE RÉFÉRENCE
- Français naturel, professionnel, chaleureux et précis.
- Email très aéré : paragraphes courts et une ligne vide entre chaque bloc.
- Commencer directement par "Bonjour Prénom," puis une courte phrase de contexte.
- Regrouper les informations par 2 à 5 sections maximum lorsque cela améliore la lecture.
- Les intitulés de sections doivent être sobres et pertinents, par exemple : **Intégration et passage en production**, **Points clés**, **Communication**, **Prochaines étapes**.
- Utiliser le Markdown **texte important** pour mettre en gras uniquement les décisions, validations, chiffres, contraintes, livrables ou prochaines étapes qui méritent réellement d'être mises en avant.
- Utiliser quelques puces seulement lorsqu'elles rendent une liste plus lisible.
- Ne pas surcharger l'email de gras, de titres ou de puces.
- Ne jamais utiliser de tableau.
- Terminer naturellement par : "Si vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible." puis la formule de politesse et la signature.

RÈGLES DE SYNTHÈSE
- Fusionner les informations répétées provenant de plusieurs notes ou appels.
- Donner la priorité aux informations les plus récentes lorsqu'une information a évolué.
- Faire ressortir ce qui a été validé, les points de vigilance et qui doit faire quoi ensuite.
- Reformuler les phrases télégraphiques en phrases professionnelles complètes.
- Supprimer les détails internes inutiles au destinataire.
- Ne jamais écrire "Pour rappel, voici les éléments évoqués : Note 1...".
- Ne jamais inventer un fait, chiffre, tarif, engagement, remise, document, date ou prochaine étape absent de la source.
- Pour un email de tarification, citer uniquement les montants et conditions explicitement présents dans la source ; sinon rester générique.
- Pour un premier contact gérant, indiquer simplement qu'un échange a eu lieu avec l'équipe ou l'accueil si la source le permet, sans laisser entendre que le dirigeant a déjà été contacté.
- Si une prochaine étape n'est pas clairement présente, ne pas en inventer une.

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
    if (!response.ok) return fallbackDraft({ ...input, kind });
    const text = extractText(payload);
    if (!text) return fallbackDraft({ ...input, kind });
    const parsed = parseJson(text);
    const subject = cleanText(parsed?.subject).slice(0, 180);
    const body = cleanText(parsed?.body).slice(0, 9000);
    if (!subject || !body) return fallbackDraft({ ...input, kind });
    return { subject, body, generatedBy: "openrouter", kind };
  } catch {
    return fallbackDraft({ ...input, kind });
  }
}
