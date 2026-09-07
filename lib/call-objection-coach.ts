export type CRMActivityRecord = {
  id?: string | number
  properties?: Record<string, string | null | undefined>
  sourceContactName?: string | null
  createdAt?: string | null
}

export type ObjectionInsight = {
  id: string
  title: string
  evidence: string
  explanation: string
  recommendedResponse: string
  nextQuestion: string
  source: "notes" | "calls" | "crm"
}

export type CallObjectionCoach = {
  insights: ObjectionInsight[]
  transcript: string
  signalsAnalyzed: number
  latestCall?: CRMActivityRecord | null
}

type CoachInput = {
  properties?: Record<string, string | null | undefined>
  notes?: CRMActivityRecord[]
  calls?: CRMActivityRecord[]
  maxActivities?: number
}

type Rule = {
  id: string
  title: string
  keywords: string[]
  explanation: string
  response: string
  nextQuestion: string
}

const RULES: Rule[] = [
  {
    id: "price",
    title: "Prix / commission",
    keywords: ["prix", "tarif", "cout", "coût", "cher", "commission", "pourcentage", "marge", "2%", "3%", "4%"],
    explanation: "Le prospect compare probablement Gando à un coût de paiement plutôt qu'au coût complet de la friction de caution.",
    response: "Ne défends pas immédiatement le tarif. Reformule d'abord l'objection, puis ramène la comparaison sur les refus de caution, le temps agent, les réservations perdues et le pouvoir d'achat bloqué.",
    nextQuestion: "Aujourd'hui, qu'est-ce qui vous coûte le plus avec la caution : les refus, le temps opérationnel ou les réservations perdues ?",
  },
  {
    id: "existing_solution",
    title: "Solution actuelle jugée suffisante",
    keywords: ["deja une solution", "déjà une solution", "ca fonctionne", "ça fonctionne", "satisfait", "preautorisation", "préautorisation", "tpe", "empreinte", "adyen", "stripe"],
    explanation: "Le prospect ne dit pas forcément qu'il n'a aucun problème ; il dit que son système actuel est acceptable dans les cas standards.",
    response: "Ne cherche pas à remplacer son système. Positionne Gando sur les cas où l'existant casse : plafond insuffisant, carte non compatible, montant élevé, location longue ou client qui refuse d'immobiliser ses fonds.",
    nextQuestion: "Dans quels cas votre système actuel échoue ou oblige vos équipes à trouver une solution manuelle ?",
  },
  {
    id: "risk",
    title: "Risque / garantie d'encaissement",
    keywords: ["risque", "garantie", "encaissement", "impaye", "impayé", "recouvrement", "sinistre", "dommage", "fraude", "securise", "sécurise"],
    explanation: "Le prospect veut être certain que supprimer le blocage de fonds ne transfère pas le risque sur le loueur.",
    response: "Commence par valider ce besoin de sécurité. Explique ensuite le parcours de sécurisation et l'encaissement en cas d'incident, sans présenter Gando comme une simple suppression de préautorisation.",
    nextQuestion: "Qu'est-ce qui doit être garanti pour que vous acceptiez de ne plus bloquer la caution sur la carte du client ?",
  },
  {
    id: "integration",
    title: "Intégration / charge technique",
    keywords: ["integration", "intégration", "api", "erp", "developpement", "développement", "technique", "webhook", "psp", "logiciel"],
    explanation: "L'objection porte souvent davantage sur le coût de changement et les ressources internes que sur la valeur de Gando.",
    response: "Sépare le test de l'intégration finale. Propose d'abord le parcours le plus léger possible, puis qualifie précisément l'ERP, le PSP et la personne qui devra valider le développement.",
    nextQuestion: "Quel ERP ou outil de réservation utilisez-vous, et qui doit valider une intégration de ce type chez vous ?",
  },
  {
    id: "timing",
    title: "Timing / priorité",
    keywords: ["plus tard", "pas maintenant", "timing", "saison", "budget", "l'année prochaine", "annee prochaine", "rappeler", "rappel", "septembre", "octobre", "2027"],
    explanation: "Ce n'est pas toujours un refus : le prospect peut manquer de bande passante, de budget ou attendre une période d'activité plus pertinente.",
    response: "Évite une relance vague. Identifie l'événement qui rendra le sujet prioritaire et transforme-le en prochaine action datée.",
    nextQuestion: "Qu'est-ce qui doit se passer pour que ce sujet devienne prioritaire, et à quelle date devons-nous le reprendre ?",
  },
  {
    id: "decision_maker",
    title: "Décideur / validation interne",
    keywords: ["gerant", "gérant", "direction", "decideur", "décideur", "responsable", "siege", "siège", "validation", "valider", "patron"],
    explanation: "L'interlocuteur peut comprendre la valeur sans avoir la capacité de faire avancer le dossier.",
    response: "Ne force pas le pitch. Aide l'interlocuteur à formuler le bénéfice pour le décideur et demande une introduction ou un rendez-vous à plusieurs.",
    nextQuestion: "Qui doit être convaincu avec vous pour décider d'un test, et quel argument sera le plus important pour cette personne ?",
  },
  {
    id: "customer_friction",
    title: "Friction client / plafond bancaire",
    keywords: ["plafond", "bloque", "bloqué", "bloquer", "fonds", "caution refusee", "caution refusée", "carte refusee", "carte refusée", "pouvoir d'achat", "abandon", "annulation"],
    explanation: "C'est un signal de douleur directement aligné avec la proposition de valeur Gando.",
    response: "Creuse le volume et l'impact avant de pitcher. Plus le SDR quantifie le problème, plus la proposition Gando devient concrète.",
    nextQuestion: "Sur un mois normal, combien de réservations ou de remises de véhicule sont réellement touchées par ce problème ?",
  },
  {
    id: "no_need",
    title: "Pas de besoin identifié",
    keywords: ["pas besoin", "aucun probleme", "aucun problème", "jamais de probleme", "jamais de problème", "pas interesse", "pas intéressé"],
    explanation: "Une réponse 'pas besoin' peut cacher soit une vraie absence de douleur, soit une douleur non mesurée.",
    response: "N'argumente pas immédiatement. Vérifie en deux questions maximum si le prospect rencontre des refus, des plafonds insuffisants ou du temps perdu. S'il n'y a réellement aucune douleur, qualifie hors cible.",
    nextQuestion: "Vous ne rencontrez donc jamais de refus ou de difficulté liée au montant de caution, même sur les cartes ou montants les plus sensibles ?",
  },
]

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

export function activityPlainText(value?: string | null) {
  if (!value) return ""
  return decodeHtml(value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function recordDate(record: CRMActivityRecord) {
  const p = record.properties || {}
  return p.hs_timestamp || p.hs_createdate || record.createdAt || ""
}

function callText(call: CRMActivityRecord) {
  const p = call.properties || {}
  return [p.hs_call_title, p.hs_call_summary, p.hs_call_body].map(activityPlainText).filter(Boolean).join(" — ")
}

function noteText(note: CRMActivityRecord) {
  return activityPlainText(note.properties?.hs_note_body)
}

function excerpt(text: string, keyword: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= 190) return clean
  const normalizedText = normalize(clean)
  const index = normalizedText.indexOf(normalize(keyword))
  if (index < 0) return `${clean.slice(0, 187)}…`
  const start = Math.max(0, index - 70)
  const end = Math.min(clean.length, index + keyword.length + 105)
  return `${start ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`
}

function sourceEntries(input: CoachInput) {
  const entries: Array<{ source: "notes" | "calls" | "crm"; text: string; date: string }> = []
  const explicit = activityPlainText(input.properties?.objections__retours)
  if (explicit) entries.push({ source: "crm", text: explicit, date: "" })

  for (const call of input.calls || []) {
    const text = callText(call)
    if (text) entries.push({ source: "calls", text, date: recordDate(call) })
  }
  for (const note of input.notes || []) {
    const text = noteText(note)
    if (text && !text.includes("GANDO_POST_CALL_EMAIL")) entries.push({ source: "notes", text, date: recordDate(note) })
  }
  return entries
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, input.maxActivities || 12)
}

export function buildCallObjectionCoach(input: CoachInput): CallObjectionCoach {
  const entries = sourceEntries(input)
  const insights: ObjectionInsight[] = []

  for (const rule of RULES) {
    let match: { source: "notes" | "calls" | "crm"; text: string; keyword: string } | null = null
    for (const entry of entries) {
      const normalizedText = normalize(entry.text)
      const keyword = rule.keywords.find(item => normalizedText.includes(normalize(item)))
      if (keyword) {
        match = { source: entry.source, text: entry.text, keyword }
        break
      }
    }
    if (!match) continue
    insights.push({
      id: rule.id,
      title: rule.title,
      evidence: excerpt(match.text, match.keyword),
      explanation: rule.explanation,
      recommendedResponse: rule.response,
      nextQuestion: rule.nextQuestion,
      source: match.source,
    })
    if (insights.length >= 4) break
  }

  const transcript = entries
    .map(entry => {
      const prefix = entry.source === "calls" ? "APPEL" : entry.source === "notes" ? "NOTE" : "OBJECTION CRM"
      return `[${prefix}${entry.date ? ` · ${entry.date}` : ""}] ${entry.text}`
    })
    .join("\n\n")

  return {
    insights,
    transcript,
    signalsAnalyzed: entries.length,
    latestCall: (input.calls || [])[0] || null,
  }
}
