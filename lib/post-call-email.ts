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
  recap: "Récapitulatif de suivi après l'appel, fidèle aux éléments réellement évoqués et centré sur la prochaine action utile si elle est explicitement connue.",
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

function sourceExcerpt(input: PostCallEmailInput) {
  return cleanText(input.transcription || input.callBody).slice(0, 1800);
}

function fallbackDraft(input: PostCallEmailInput): PostCallEmailDraft {
  const kind = input.kind || "recap";
  const firstName = cleanText(input.firstName);
  const companyName = cleanText(input.companyName);
  const senderName = cleanText(input.senderName) || "L’équipe Gando";
  const source = sourceExcerpt(input);
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const sourceBlock = source ? `\n\nPour rappel, voici les éléments évoqués :\n${source}` : "";

  if (kind === "post_demo") {
    return {
      kind,
      subject: companyName ? `Suite à notre démonstration — Gando × ${companyName}` : "Suite à notre démonstration — Gando",
      body: `${greeting}\n\nMerci pour le temps accordé lors de la démonstration de Gando.${sourceBlock}\n\nJe reste disponible pour répondre à vos questions et avancer sur la suite lorsque vous le souhaitez.\n\nBien à vous,\n${senderName}`,
      generatedBy: "fallback",
    };
  }

  if (kind === "pricing_info") {
    return {
      kind,
      subject: companyName ? `Informations et tarifs Gando — ${companyName}` : "Informations et tarifs Gando",
      body: `${greeting}\n\nComme convenu, je vous transmets les éléments demandés concernant Gando et sa tarification.${sourceBlock}\n\nSi vous souhaitez que je précise un point ou que nous regardions ensemble le cas de votre activité, je reste disponible.\n\nBien à vous,\n${senderName}`,
      generatedBy: "fallback",
    };
  }

  if (kind === "decision_maker_intro") {
    return {
      kind,
      subject: companyName ? `Présentation de Gando — ${companyName}` : "Présentation de Gando",
      body: `${greeting}\n\nSuite à un échange avec votre équipe, je me permets de vous contacter au sujet de Gando, notre solution dédiée à la gestion des cautions dans la location.${sourceBlock}\n\nJe serais ravi de vous présenter rapidement le fonctionnement et de voir si le sujet peut être pertinent pour votre activité.\n\nBien à vous,\n${senderName}`,
      generatedBy: "fallback",
    };
  }

  return {
    kind,
    subject: companyName ? `Suite à notre échange — Gando × ${companyName}` : "Suite à notre échange — Gando",
    body: `${greeting}\n\nMerci pour notre échange.${sourceBlock || "\n\nComme convenu, je vous transmets ce récapitulatif afin que vous puissiez le partager facilement en interne."}\n\nSi vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible.\n\nBien à vous,\n${senderName}`,
    generatedBy: "fallback",
  };
}

export async function generatePostCallEmail(input: PostCallEmailInput): Promise<PostCallEmailDraft> {
  const kind = input.kind || "recap";
  const source = cleanText(input.transcription || input.callBody).slice(0, 12000);
  if (!source) return fallbackDraft({ ...input, kind });

  const token = await getOpenRouterApiKey();
  if (!token) return fallbackDraft({ ...input, kind });

  const prompt = `Tu rédiges un email commercial pour Gando.app.
Type d'email : ${POST_CALL_EMAIL_LABELS[kind]}.
Objectif métier : ${EMAIL_GOALS[kind]}

Rédige un email en français, naturel, professionnel, court et actionnable.
N'invente aucun fait, chiffre, promesse, tarif, remise, prochaine étape ou document qui n'apparaît pas dans la source.
Pour un email de tarification, cite uniquement les montants et conditions explicitement présents dans la source ; sinon reste générique sur les éléments tarifaires demandés.
Pour un premier contact gérant, indique simplement qu'un échange a eu lieu avec l'équipe ou l'accueil si la source le permet, sans laisser entendre que le dirigeant a déjà été contacté.
Conserve uniquement les points utiles au prospect : contexte, besoin, ce qui a été expliqué, demandes du prospect et éventuelles prochaines étapes réellement mentionnées.
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
    if (!response.ok) return fallbackDraft({ ...input, kind });
    const text = extractText(payload);
    if (!text) return fallbackDraft({ ...input, kind });
    const parsed = parseJson(text);
    const subject = cleanText(parsed?.subject).slice(0, 180);
    const body = cleanText(parsed?.body).slice(0, 7000);
    if (!subject || !body) return fallbackDraft({ ...input, kind });
    return { subject, body, generatedBy: "openrouter", kind };
  } catch {
    return fallbackDraft({ ...input, kind });
  }
}
