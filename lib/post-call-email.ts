import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST_CALL_EMAIL_LABELS, type PostCallEmailKind } from "@/lib/post-call-email-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_EMAIL_MODEL = "~anthropic/claude-sonnet-latest";

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
  model: string;
};

const EMAIL_GOALS: Record<PostCallEmailKind, string> = {
  post_demo: "Relancer après une démonstration déjà réalisée. Rappeler uniquement les éléments décisifs de la démo et faire ressortir la prochaine étape réellement convenue, sans pression commerciale artificielle.",
  pricing_info: "Répondre à une demande d'informations commerciales ou tarifaires. Présenter clairement les montants, frais, offres ou conditions réellement présents dans la source et expliquer ce qu'ils signifient pour le prospect, sans rien inventer.",
  decision_maker_intro: "Rédiger un premier contact destiné au gérant, dirigeant ou décisionnaire après un échange avec l'accueil ou un membre de l'équipe. Donner suffisamment de contexte pour que le destinataire comprenne immédiatement pourquoi Gando le contacte, sans prétendre lui avoir déjà parlé.",
  recap: "Rédiger un compte-rendu commercial clair de l'échange. Faire ressortir les décisions, validations, contraintes, questions ouvertes et prochaines actions réellement convenues, sans recopier les notes internes.",
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
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[^\s]+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/)
    .map(item => item.trim())
    .filter(item => item.length >= 35 && item.length <= 320)
    .filter(item => !/^(bonjour|merci|cordialement|bien à vous)/i.test(item));

  const highlights: string[] = [];
  for (const sentence of sentences) {
    const shortened = sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence;
    if (!highlights.some(existing => existing.toLowerCase() === shortened.toLowerCase())) highlights.push(shortened);
    if (highlights.length >= 3) break;
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
    : "Je vous partage ce message afin de garder une trace claire de notre échange et de faciliter la suite de nos discussions.";

  const subjectByKind: Record<PostCallEmailKind, string> = {
    post_demo: companyName ? `Suite à notre démonstration — ${companyName} × Gando` : "Suite à notre démonstration — Gando",
    pricing_info: companyName ? `Éléments évoqués concernant Gando — ${companyName}` : "Éléments évoqués concernant Gando",
    decision_maker_intro: companyName ? `Gando × ${companyName} — prise de contact` : "Gando — prise de contact",
    recap: companyName ? `Suite à notre échange — ${companyName} × Gando` : "Suite à notre échange — Gando",
  };

  const introByKind: Record<PostCallEmailKind, string> = {
    post_demo: "Suite à notre démonstration, je vous partage ci-dessous les éléments principaux à retenir.",
    pricing_info: "Comme convenu, je vous partage une synthèse des éléments évoqués concernant Gando.",
    decision_maker_intro: "Suite à un échange avec votre équipe, je me permets de vous contacter au sujet de Gando et de vous transmettre les principaux éléments utiles.",
    recap: "Suite à notre échange, je vous partage ci-dessous une synthèse des éléments principaux.",
  };

  return {
    kind,
    subject: subjectByKind[kind],
    body: `${greeting}\n\n${introByKind[kind]}\n\n${recap}\n\nSi vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible.\n\nBien à vous,\n${senderName}`,
    generatedBy: "fallback",
    model: "fallback-local",
  };
}

export async function generatePostCallEmail(input: PostCallEmailInput): Promise<PostCallEmailDraft> {
  const kind = input.kind || "recap";
  const source = cleanText(input.transcription || input.callBody).slice(0, 12000);
  if (!source) return fallbackDraft({ ...input, kind });

  const token = await getOpenRouterApiKey();
  if (!token) return fallbackDraft({ ...input, kind });

  const model = process.env.OPENROUTER_EMAIL_MODEL?.trim() || DEFAULT_EMAIL_MODEL;

  const systemPrompt = `Tu es le rédacteur commercial senior de Gando.app. Tu transformes des notes CRM et des transcriptions parfois longues, désordonnées ou télégraphiques en emails B2B élégants, précis et immédiatement envoyables à des dirigeants, responsables d'agence et partenaires.

Ta priorité absolue est la qualité éditoriale : le destinataire doit avoir l'impression qu'un commercial expérimenté a relu l'historique, compris ce qui compte et rédigé personnellement l'email.

PRINCIPES NON NÉGOCIABLES
1. Tu SYNTHÉTISES : tu ne recopies jamais les notes brutes, même si elles contiennent beaucoup d'informations.
2. Tu HIÉRARCHISES : décisions, validations, contraintes, chiffres utiles, engagements et prochaines étapes passent avant les détails secondaires.
3. Tu REFORMULES : transforme les listes télégraphiques en phrases naturelles et professionnelles.
4. Tu DÉDOUBLONNES : une information répétée plusieurs fois n'apparaît qu'une seule fois.
5. Tu ACTUALISES : si deux notes se contredisent, l'information la plus récente prévaut.
6. Tu N'INVENTES RIEN : aucun tarif, chiffre, engagement, rendez-vous, document, promesse ou prochaine étape absent de la source.
7. Tu ÉCRIS POUR LE DESTINATAIRE : supprime les commentaires internes, horodatages, noms d'auteurs, "Note 1", "Note 2", identifiants CRM et jargon opérationnel inutile.

STYLE GANDO
- Français naturel, sobre, professionnel et humain.
- Pas de ton robotique, administratif ou excessivement commercial.
- Pas de phrases creuses du type "nous sommes ravis de", "dans le cadre de", "je reviens vers vous afin de" sauf nécessité réelle.
- Pas de superlatifs inutiles.
- Paragraphes courts, une idée principale par paragraphe.
- Utilise le gras Markdown **ainsi** uniquement sur 3 à 7 éléments vraiment importants dans tout l'email : validation, décision, montant, contrainte ou action.
- Les titres de sections ne sont PAS obligatoires. Utilise-les uniquement lorsqu'il existe au moins 3 sujets distincts et que cela améliore clairement la lecture.
- Si tu utilises des titres, choisis des titres spécifiques au contenu. Évite les titres génériques répétés comme "Points clés" si un titre plus précis est possible.
- Utilise des puces uniquement pour une vraie liste de 3 éléments ou plus.
- Ne mets jamais de tableau.
- Longueur cible : environ 180 à 350 mots. Tu peux être plus court si l'échange contient peu d'informations.
- L'objet doit être naturel, précis et non marketing. Évite les objets trop longs.

STRUCTURE À CHOISIR SELON LE CONTENU
A. Échange simple : salutation + contexte en 1 phrase + 2 à 4 paragraphes + conclusion.
B. Échange riche avec plusieurs sujets : salutation + contexte + 2 à 4 sections courtes spécifiques + prochaines étapes si elles existent + conclusion.
C. Demande de tarifs : contexte + éléments tarifaires réellement présents + ce qu'il faut retenir + suite réellement convenue.
D. Premier contact dirigeant : raison du contact + problème/besoin identifié auprès de l'équipe + proposition Gando pertinente + invitation simple à échanger, sans prétendre avoir déjà parlé au dirigeant.

FIN D'EMAIL
Si cela reste naturel, termine par : "Si vous souhaitez que je précise un point ou que je vous transmette un élément complémentaire, je reste disponible."
Puis "Bien à vous," et la signature fournie.

Tu réponds uniquement avec un JSON valide contenant exactement deux champs : {"subject":"...","body":"..."}.`;

  const userPrompt = `TYPE D'EMAIL : ${POST_CALL_EMAIL_LABELS[kind]}
OBJECTIF : ${EMAIL_GOALS[kind]}

DESTINATAIRE
Prénom : ${cleanText(input.firstName) || "non précisé"}
Entreprise : ${cleanText(input.companyName) || "non précisée"}
Intitulé de l'échange : ${cleanText(input.callTitle) || "Appel"}
Signature : ${cleanText(input.senderName) || "L’équipe Gando"}

SOURCE CRM À ANALYSER
${source}

Avant de rédiger, fais silencieusement ce travail :
- identifie les faits certains ;
- regroupe les sujets similaires ;
- repère ce qui a changé entre les notes ;
- distingue ce qui est déjà fait de ce qui reste à faire ;
- élimine ce qui n'est pas utile au destinataire.

Rédige ensuite l'email final. Ne montre jamais ton analyse et ne mentionne jamais les notes CRM.`;

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
        model,
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallbackDraft({ ...input, kind });
    const text = extractText(payload);
    if (!text) return fallbackDraft({ ...input, kind });
    const parsed = parseJson(text);
    const subject = cleanText(parsed?.subject).slice(0, 180);
    const body = cleanText(parsed?.body).slice(0, 9000);
    if (!subject || !body) return fallbackDraft({ ...input, kind });
    return {
      subject,
      body,
      generatedBy: "openrouter",
      kind,
      model: typeof payload?.model === "string" ? payload.model : model,
    };
  } catch {
    return fallbackDraft({ ...input, kind });
  }
}
