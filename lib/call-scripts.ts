export type SalesCallScript = {
  id: string
  name: string
  segment: string
  description?: string | null
  is_active: boolean
  is_default: boolean
  source_url?: string | null
  introduction: string
  discovery_questions: string[]
  value_proposition: string
  closing: string
  qualification_rules: string[]
  objections: string[]
  created_at?: string
  updated_at?: string
}

export type ScriptContact = {
  id: string
  properties: Record<string, string | null | undefined>
}

function value(input?: string | null, fallback = "") {
  const normalized = String(input || "").trim()
  return normalized || fallback
}

export function scriptVariables(contact: ScriptContact) {
  const p = contact.properties
  const firstname = value(p.firstname, value(p.lastname, ""))
  const company = value(p.company || p.hs_parent_company_name, "votre agence")
  const city = value(p.city || p.state || p.country, "votre zone")
  const deposit = value(p.montant_caution || p.deposit_amount || p.caution_moyenne, "le montant de la caution")
  return {
    firstname,
    lastname: value(p.lastname),
    company,
    city,
    jobtitle: value(p.jobtitle, "votre rôle"),
    fleet: value(p.taille_de_flo || p.taille_flotte, "votre flotte"),
    payment: value(p.solution_paiement_reservation, "votre solution actuelle"),
    deposit_hint: deposit,
  }
}

export function renderCallTemplate(template: string, contact: ScriptContact) {
  const variables = scriptVariables(contact)
  return template.replace(/\{\{([a-z_]+)\}\}/gi, (_match, key: string) => {
    return (variables as Record<string, string>)[key] ?? ""
  })
}

export function generateCallScript(script: SalesCallScript, contact: ScriptContact) {
  const p = contact.properties
  const payment = value(p.solution_paiement_reservation)
  const fleet = value(p.taille_de_flo || p.taille_flotte)
  const objection = value(p.objections__retours)
  const location = [p.zip, p.city, p.state, p.country].filter(Boolean).join(" · ")

  const contextualDiscovery: string[] = []
  if (payment) contextualDiscovery.push(`Vous utilisez actuellement ${payment}. Comment la caution s’intègre-t-elle dans ce parcours ?`)
  if (fleet) contextualDiscovery.push(`Avec une flotte de ${fleet}, où la gestion de la caution vous fait-elle perdre le plus de temps ?`)
  if (location) contextualDiscovery.push(`Sur votre activité à ${location}, les montants de caution ou les habitudes clients créent-ils une friction particulière ?`)

  const valueContext: string[] = []
  if (payment) valueContext.push(`Le but n’est pas de remplacer ${payment} si cela fonctionne, mais de traiter spécifiquement la friction liée à la caution.`)
  if (objection) valueContext.push(`Point déjà identifié : ${objection}`)

  return {
    introduction: renderCallTemplate(script.introduction, contact),
    discoveryQuestions: [...contextualDiscovery, ...script.discovery_questions],
    valueProposition: [renderCallTemplate(script.value_proposition, contact), ...valueContext].filter(Boolean).join(" "),
    closing: renderCallTemplate(script.closing, contact),
    qualificationRules: script.qualification_rules,
    objections: script.objections,
  }
}
