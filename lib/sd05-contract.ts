import type { SD05Content, SD05TemplateId } from "@/lib/sd-stage-content";

export const SD05_SIGNATURE_CONSENT =
  "Je reconnais avoir lu le contrat dans son intégralité, je confirme mon identité et mon pouvoir de représenter l'organisation indiquée, et j'accepte de signer électroniquement ce document. Je comprends que mon nom, mon adresse email, la date et l'heure, les informations techniques de connexion, mon mode de signature, mes paraphes et l'empreinte du document seront conservés comme éléments de preuve.";

export const SD05_TEMPLATE_VERSION = "GANDO-SD05-2026-08";
export const SD05_PARTNERSHIP_TEMPLATE_VERSION = "GANDO-SD05-PARTNER-2026-08";
export const SD05_DEFAULT_FOOTER =
  "CONFIDENTIALITÉ — Ce document (ainsi que toutes les pièces jointes et éléments de preuve) est confidentiel. Toute publication, utilisation ou diffusion, même partielle, doit être autorisée préalablement. Si vous n'êtes pas destinataire de ce document, merci d'en avertir immédiatement Gando à contact@gando.app. GANDO SOLUTIONS · SAS au capital de 1 000,00 euros · 3 chemin de la porte verte, 77144 Montévrain · RCS Meaux 943 391 201.";

const SERVICE_TEMPLATE_BODY = `PRÉAMBULE
Gando édite une solution numérique destinée aux professionnels de la location, permettant notamment de digitaliser le dépôt de garantie, d'évaluer l'éligibilité d'un Client Final et d'organiser, le cas échéant, l'encaissement de sommes contractuellement dues au Loueur utilisateur.

Le Loueur utilisateur exerce une activité professionnelle de location et souhaite utiliser les Services afin de limiter l'immobilisation initiale des fonds de ses Clients Finaux tout en sécurisant son processus de recouvrement.

Les Parties reconnaissent que les services réglementés de paiement et d'accès aux données bancaires sont exécutés par des prestataires habilités, selon leurs propres conditions.

Les Parties ont en conséquence convenu ce qui suit. Le Préambule et les Annexes font partie intégrante du Contrat.

ARTICLE 1 : DÉFINITIONS
« Caution / Dépôt de garantie » : montant stipulé au contrat de location afin de garantir les sommes pouvant devenir dues par le Client Final, sans blocage initial de ce montant sur son compte, sous réserve du parcours Gando.

« Frais de Sécurisation » : commission prélevée par Gando sur le montant de la Caution, payée par le Client Final.

« Frais d'encaissement » : frais prélevés par Gando en cas de sinistre, payés par le Loueur.

« Contrat » : le présent contrat, son Préambule, ses Annexes et tout avenant signé.

« Demande d'Encaissement » : demande documentée du Loueur utilisateur portant sur une créance certaine, liquide et exigible résultant du Contrat de location.

« Services » : ensemble des services, API et interfaces web de Gando.

ARTICLE 2 : OBJET ET PÉRIMÈTRE
Le Contrat définit les conditions dans lesquelles Gando concède au Loueur utilisateur un accès professionnel, personnel et non exclusif aux Services. Le Contrat ne modifie pas la relation de location entre le Loueur utilisateur et le Client Final.

ARTICLE 3 : DOCUMENTS CONTRACTUELS ET OPPOSABILITÉ
Les CGUV Gando applicables au Loueur, annexes comprises, sont incorporées au Contrat. Le Loueur utilisateur reconnaît avoir pu les consulter, les télécharger et les conserver avant la signature.

3.1. Ordre de priorité
Pour la relation entre Gando et le Loueur utilisateur, l'ordre de priorité décroissant est : (1) la Fiche de validation ; (2) le corps du Contrat ; (3) les Annexes ; (4) les CGUV Gando ; puis (5) la documentation technique, sauf stipulation expresse contraire.

ARTICLE 4 : MISE EN SERVICE ET ACCÈS
La mise en production est subordonnée à la vérification de l'identité du Loueur utilisateur et de ses représentants, à la remise des documents KYB demandés, à la configuration du compte, à la transmission de ses CGL, à l'acceptation des conditions applicables et au règlement des sommes exigibles.

ARTICLE 5 : ÉLIGIBILITÉ DES CAUTIONS ET TERRITOIRE
Une Caution n'est Éligible que si elle concerne une location réelle et licite, respecte les montants et durées convenus, a été activée selon le parcours Gando, a donné lieu aux consentements et paiements requis, repose sur un Contrat de location opposable et sur des preuves suffisantes, et ne présente pas d'indice de fraude, de collusion ou de contournement.

ARTICLE 6 : DEMANDE D'ENCAISSEMENT ET GARANTIE
Le Loueur utilisateur dépose depuis son espace Gando une Demande d'Encaissement documentée pendant la Durée de Sécurisation. Gando vérifie la complétude et l'éligibilité du dossier et met en œuvre les étapes de recouvrement prévues par les conditions applicables.

ARTICLE 7 : OBLIGATIONS DE GANDO
Gando s'engage à fournir les Services avec diligence selon une obligation de moyens, traiter les Cautions Éligibles et les Demandes d'Encaissement conformément au Contrat, mettre à disposition la documentation nécessaire et respecter ses obligations légales en matière de données et de sécurité.

ARTICLE 8 : OBLIGATIONS DU LOUEUR UTILISATEUR
Le Loueur utilisateur s'engage notamment à utiliser les Services uniquement pour ses propres locations, transmettre des informations complètes et exactes, conserver les justificatifs utiles, maintenir ses CGL et assurances conformes, réaliser les états des lieux nécessaires et ne pas contourner le parcours Gando.

ARTICLE 9 : CONDITIONS FINANCIÈRES
Les conditions financières particulières sont celles figurant sur la Fiche de validation et dans l'encadré « Structure tarifaire » du présent SD05. Les montants HT, taxes applicables et montants TTC sont distingués conformément au régime fiscal applicable.

ARTICLE 10 : PAIEMENTS ET PRESTATAIRES RÉGLEMENTÉS
Les opérations de paiement, l'authentification forte et l'accès aux données de compte sont réalisés par un ou plusieurs Prestataires Réglementés. Le Loueur utilisateur et/ou le Client Final peuvent devoir accepter leurs conditions et se soumettre à leurs contrôles.

ARTICLE 11 : DONNÉES PERSONNELLES
Les rôles de chaque Partie sont déterminés traitement par traitement. Chaque Partie assure la licéité, la transparence, la minimisation, l'exactitude, la sécurité et la conservation limitée des données relevant de sa responsabilité.

ARTICLE 12 : SÉCURITÉ ET CONTINUITÉ
Chaque Partie met en œuvre des mesures techniques et organisationnelles proportionnées, incluant notamment le contrôle des accès, l'authentification, le chiffrement des flux, la journalisation, les sauvegardes et une procédure de réponse aux incidents.

ARTICLE 13 : CONFIDENTIALITÉ
Chaque Partie protège les informations non publiques de l'autre Partie et ne les utilise que pour exécuter le Contrat. L'obligation de confidentialité s'applique pendant le Contrat et cinq (5) ans après son terme, sans préjudice des durées légales ou de la nature des informations concernées.

ARTICLE 14 : PROPRIÉTÉ INTELLECTUELLE ET RÉFÉRENCES
Chaque Partie conserve ses droits antérieurs. Gando demeure titulaire de sa plateforme, de ses API, algorithmes, modèles de risque, bases, interfaces, documentations, marques et évolutions. Le Contrat ne transfère aucun droit de propriété.

ARTICLE 15 : RESPONSABILITÉ ET ASSURANCES
Chaque Partie répond des dommages directs et prévisibles causés à l'autre par son manquement prouvé. Le Loueur utilisateur demeure responsable de la location, du bien loué, de ses CGL, de ses états des lieux et de la légitimité de sa créance.

ARTICLE 16 : SOUS-TRAITANCE ET CESSION
Gando peut sous-traiter tout ou partie des Services à des hébergeurs et prestataires techniques, de paiement, d'open banking, de fraude ou de recouvrement, tout en restant responsable de ses obligations propres dans les limites du Contrat.

ARTICLE 17 : DURÉE ET RENOUVELLEMENT
Le Contrat entre en vigueur à sa date de dernière signature pour la préparation et la mise en service. Les opérations en production débutent à la date renseignée sur la Fiche de validation. La durée initiale, le renouvellement et le préavis sont ceux indiqués dans les conditions particulières du présent SD05.

ARTICLE 18 : SUSPENSION
Gando peut suspendre tout ou partie des Services en cas de risque de fraude ou de sécurité, activité interdite, exigence d'une autorité ou d'un Prestataire Réglementé, informations KYC/KYB manquantes, violation grave du Contrat ou impayé dans les conditions prévues.

ARTICLE 19 : RÉSILIATION ET EFFETS
En cas de manquement substantiel non réparé après mise en demeure, l'autre Partie peut résilier le Contrat conformément aux délais convenus. La résiliation peut être immédiate en cas de fraude, atteinte grave à la sécurité, usage illicite ou manquement rendant impossible le maintien de la relation.

ARTICLE 20 : FORCE MAJEURE
Aucune Partie n'est responsable d'un manquement empêché par un événement de force majeure au sens de l'article 1218 du Code civil. La Partie affectée informe l'autre sans délai, limite les conséquences et reprend l'exécution dès que possible.

ARTICLE 21 : DISPOSITIONS GÉNÉRALES
Les Parties sont des cocontractants indépendants. Le Contrat ne crée ni société commune, ni mandat général, ni agence commerciale, ni exclusivité.

21.1. Preuve et signature électronique
Les journaux, traces d'authentification, horodatages, emails, documents déposés, signatures, paraphes et enregistrements des systèmes font preuve jusqu'à preuve contraire. La signature électronique produit les mêmes effets que la signature manuscrite, sous réserve de l'identification des signataires et de l'intégrité du document.

21.2. Droit applicable et juridiction
Le Contrat et les CGUV Gando sont soumis au droit français. Avant toute action, les Parties tentent une résolution amiable dans les conditions prévues au Contrat. À défaut, la juridiction compétente est celle prévue par les conditions contractuelles applicables.

ANNEXE 1 : CONDITIONS FINANCIÈRES ET COMMERCIALES
Les conditions financières détaillées figurent dans la Fiche de validation, dans l'encadré « Structure tarifaire » et, le cas échéant, dans toute annexe commerciale expressément intégrée au Contrat.

ANNEXE 2 : DOSSIER D'ENCAISSEMENT
Pour chaque Demande d'Encaissement, le Loueur utilisateur conserve et transmet les justificatifs prévus par les CGUV Gando et les conditions particulières.

ANNEXE 3 : CLAUSE À INTÉGRER AUX CONDITIONS GÉNÉRALES DE LOCATION
Le Loueur utilisateur veille à intégrer à ses Conditions générales de location la clause Gando applicable ou une clause d'effet juridique équivalent, adaptée au parcours effectivement proposé au Client Final.`;

const PARTNERSHIP_TEMPLATE_BODY = `PRÉAMBULE
Gando édite et exploite une solution de caution digitale destinée aux professionnels de la location. Le Partenaire édite ou exploite une solution, un réseau ou un canal de distribution permettant de proposer les Services Gando à des professionnels de la location.

À l'issue de leurs échanges, les Parties souhaitent formaliser un partenariat permettant le référencement, l'intégration et la promotion des Services Gando. Les Loueurs qui activent les Services deviennent des clients de Gando et contractent directement avec cette dernière selon les conditions applicables.

C'est dans ce contexte que les Parties se sont rapprochées et ont convenu de ce qui suit.

ARTICLE 1 : OBJET
La présente convention a pour objet de définir les conditions dans lesquelles le Partenaire référence et promeut les Services Gando, met en œuvre les moyens techniques ou commerciaux convenus et, le cas échéant, permet aux Loueurs d'accéder aux Services depuis son environnement.

ARTICLE 2 : DÉFINITIONS
« Loueur » : professionnel de la location, client ou utilisateur du Partenaire, qui active les Services Gando.

« Client Final » : personne physique ou morale effectuant une location auprès d'un Loueur.

« Services » : ensemble des services, fonctionnalités, API et interfaces web proposés par Gando.

« Activation » : processus par lequel un Loueur manifeste sa volonté d'utiliser les Services Gando et accepte les conditions applicables.

ARTICLE 3 : OBLIGATIONS DE GANDO
3.1. Mise à disposition technique
Gando met à disposition les moyens techniques raisonnablement nécessaires à l'intégration convenue, notamment la documentation, les accès et un support d'intégration.

3.2. Mise à disposition des Services
Gando demeure seule responsable de l'exploitation, de l'évolution et de la fourniture de ses Services aux Loueurs et Clients Finaux, dans le cadre de sa relation directe avec eux.

3.3. Supports d'onboarding et de formation
Gando fournit au Partenaire les supports raisonnablement nécessaires à la présentation et à l'onboarding des Loueurs.

ARTICLE 4 : OBLIGATIONS DU PARTENAIRE
4.1. Intégration technique et sécurité
Le Partenaire réalise l'intégration conformément à la documentation fournie, protège les identifiants et clés d'accès, et ne modifie pas les parcours Gando sans accord préalable.

4.2. Déploiement initial et onboarding des Loueurs
Le Partenaire informe ses clients de la disponibilité des Services Gando selon les modalités convenues entre les Parties.

4.3. Promotion de la solution Gando
Le Partenaire peut mettre en relation les Loueurs intéressés avec Gando et s'engage à présenter les Services de manière loyale et exacte.

4.4. Communication
Aucune Partie ne peut utiliser publiquement le nom, la marque ou le logo de l'autre Partie en dehors des usages autorisés par écrit.

ARTICLE 5 : VOLET CAUTION DU SERVICE
5.1. Description du service
Les paramètres de caution, durées, montants, conditions d'éligibilité et territoires applicables sont déterminés par Gando et/ou convenus avec chaque Loueur.

5.2. Conditions tarifaires applicables aux Loueurs
Chaque Loueur contracte directement avec Gando. Les conditions tarifaires et opérationnelles applicables sont définies individuellement entre Gando et le Loueur concerné.

5.3. Redevance due au Partenaire
La redevance éventuellement due au Partenaire est celle indiquée dans l'encadré « Structure tarifaire » ou dans les conditions particulières du présent SD05. À défaut de montant renseigné, aucune redevance n'est réputée convenue.

ARTICLE 6 : ACTIVATION DES LOUEURS
6.1. Processus
Le Loueur manifeste sa volonté d'activer Gando, est redirigé vers le parcours sécurisé prévu, accepte les conditions applicables et finalise les vérifications nécessaires.

6.2. Consentement et droit de refus
Le Partenaire veille à recueillir les consentements nécessaires. Gando se réserve le droit de refuser une Activation pour un motif légitime de conformité, de sécurité, de fraude ou de risque.

ARTICLE 7 : PROPRIÉTÉ INTELLECTUELLE
Chaque Partie demeure titulaire de ses droits antérieurs, logiciels, API, documentations, marques, noms de domaine, savoir-faire et développements. Aucune cession n'est consentie sauf stipulation expresse.

ARTICLE 8 : DONNÉES PERSONNELLES
Chaque Partie agit selon le rôle qui lui incombe au regard des traitements qu'elle détermine et respecte le RGPD ainsi que la réglementation applicable en matière de protection des données personnelles.

ARTICLE 9 : CONFIDENTIALITÉ
9.1. Informations confidentielles
Sont confidentielles toutes informations non publiques, notamment techniques, commerciales, financières, juridiques, opérationnelles ou stratégiques, échangées dans le cadre du partenariat.

9.2. Obligations réciproques
Chaque Partie protège les Informations Confidentielles, en limite l'accès aux personnes ayant besoin d'en connaître et ne les utilise que pour l'exécution de la Convention.

ARTICLE 10 : RESPONSABILITÉ
Chaque Partie est responsable des dommages directs causés à l'autre du fait d'un manquement prouvé à ses obligations. Les limitations particulières de responsabilité applicables sont celles expressément convenues entre les Parties.

ARTICLE 11 : DURÉE, RENOUVELLEMENT ET RÉSILIATION
11.1. Durée
La durée initiale est celle indiquée dans les conditions particulières du présent SD05.

11.2. Renouvellement
Le renouvellement est régi par le mécanisme renseigné dans les conditions particulières.

11.3. Résiliation
Chaque Partie peut résilier la Convention selon le préavis renseigné. En cas de manquement substantiel non réparé, la Partie non défaillante peut mettre fin à la Convention après mise en demeure restée sans effet.

ARTICLE 12 : NON-EXCLUSIVITÉ
Sauf stipulation expresse contraire, la Convention est conclue sans exclusivité. Chaque Partie reste libre de travailler avec d'autres acteurs, y compris concurrents.

ARTICLE 13 : COMMUNICATIONS ET NOTIFICATIONS
Les notifications contractuelles sont adressées aux contacts renseignés par les Parties. Tout changement de coordonnées doit être communiqué dans un délai raisonnable.

ARTICLE 14 : MISE EN PRODUCTION ET EXÉCUTION
14.1. Prise d'effet
La Convention entre en vigueur à la date de sa dernière signature électronique. La date de mise en production est celle renseignée dans les conditions particulières.

14.2. Coopération
Chaque Partie mobilise les ressources raisonnablement nécessaires à la mise en production et informe l'autre de tout retard susceptible d'affecter le calendrier.

ARTICLE 15 : DISPOSITIONS DIVERSES
La Convention et ses annexes constituent l'intégralité de l'accord sur leur objet. Toute modification substantielle fait l'objet d'un écrit accepté par les Parties. La Convention peut être signée électroniquement ; chaque Partie reconnaît à cette signature la même valeur probante qu'une signature manuscrite.

ARTICLE 16 : DROIT APPLICABLE ET JURIDICTION
La Convention est soumise au droit français. En cas de différend, les Parties recherchent d'abord une solution amiable. À défaut, le litige est porté devant la juridiction compétente prévue dans les conditions particulières ou, à défaut, selon les règles de droit commun.`;

function clean(value: unknown, max = 60_000) {
  return String(value || "").trim().slice(0, max);
}

function cleanList(value: unknown, maxItems = 80) {
  return Array.isArray(value) ? value.map(item => clean(item, 2_000)).filter(Boolean).slice(0, maxItems) : [];
}

function baseTemplate(companyName: string, template: SD05TemplateId): Pick<SD05Content,
  "contractUrl" | "contractStatus" | "effectiveDate" | "signatureDeadline" | "finalConditions" | "goLiveDate" | "handoverPlan" |
  "footerConfidentialityText" | "emailIntroText" | "allowTypedSignature" | "allowDrawnSignature" | "requireInitialsEachPage" | "contractTemplate"
> {
  return {
    contractUrl: "",
    contractStatus: "draft",
    contractTemplate: template,
    footerConfidentialityText: SD05_DEFAULT_FOOTER,
    emailIntroText: `Vous êtes invité à consulter puis signer électroniquement le document préparé entre Gando et ${companyName}.`,
    allowTypedSignature: true,
    allowDrawnSignature: true,
    requireInitialsEachPage: true,
    effectiveDate: "",
    signatureDeadline: "",
    finalConditions: [],
    goLiveDate: "",
    handoverPlan: [],
  };
}

export function createGandoSD05Template(companyName = "Client"): SD05Content {
  return {
    ...baseTemplate(companyName, "gando_standard"),
    contractTitle: `Convention de services Gando × ${companyName}`,
    contractReference: `SD05-${new Date().getFullYear()}-`,
    contractVersion: SD05_TEMPLATE_VERSION,
    contractSummary: SERVICE_TEMPLATE_BODY,
    term: "12 mois à compter de la date de mise en production",
    renewal: "Renouvellement tacite par périodes de 12 mois, sauf dénonciation dans le délai contractuel.",
    terminationNotice: "Préavis contractuel à compléter avant envoi en signature.",
    legalItems: [
      { topic: "Frais de sécurisation Gando", status: "approved", owner: "Gando", notes: "2,5 % HT du montant de la Caution Gando activée." },
      { topic: "Investissement de mise en place", status: "approved", owner: "Gando", notes: "480 € HT, intégralement investi et supporté initialement par Gando Solutions." },
      { topic: "Caution éligible", status: "approved", owner: "Gando", notes: "Caution comprise entre 1 000 € et 2 500 € inclus, sous réserve des conditions contractuelles." },
      { topic: "Frais d'encaissement", status: "approved", owner: "Loueur", notes: "3,5 % HT du montant effectivement encaissé ou avancé + 2 € HT par Demande d'Encaissement aboutie." },
    ],
    signatories: [
      { name: "", role: "", organization: companyName, email: "", signatureStatus: "pending" },
      { name: "Bilayl MATOU", role: "Président", organization: "GANDO SOLUTIONS", email: "", signatureStatus: "pending" },
    ],
    signatureSteps: [
      "Le signataire reçoit un lien personnel par email.",
      "Le document présenté est figé et identifié par une empreinte SHA-256.",
      "Le signataire paraphe les pages lorsque cette option est activée.",
      "Le signataire choisit une signature manuscrite ou une signature écrite avec son nom complet.",
      "La date, l'heure, l'email, les informations techniques de connexion et le journal d'audit sont conservés comme éléments de preuve.",
    ],
  };
}

export function createGandoPartnershipTemplate(companyName = "Partenaire"): SD05Content {
  return {
    ...baseTemplate(companyName, "legal_convention"),
    contractTitle: `Convention de partenariat Gando × ${companyName}`,
    contractReference: `SD05-PARTNER-${new Date().getFullYear()}-`,
    contractVersion: SD05_PARTNERSHIP_TEMPLATE_VERSION,
    contractSummary: PARTNERSHIP_TEMPLATE_BODY,
    term: "12 mois à compter de la date de mise en production",
    renewal: "Renouvellement tacite par périodes successives de 12 mois, sauf dénonciation dans le délai contractuel.",
    terminationNotice: "Préavis à compléter avant envoi en signature.",
    legalItems: [
      { topic: "Périmètre du partenariat", status: "open", owner: "Gando × Partenaire", notes: "Référencement, intégration et promotion des Services Gando." },
      { topic: "Redevance partenaire", status: "open", owner: "Gando", notes: "À compléter selon les conditions commerciales négociées." },
      { topic: "Mise en production", status: "open", owner: "Gando × Partenaire", notes: "Date à compléter dans les conditions particulières." },
    ],
    signatories: [
      { name: "", role: "", organization: companyName, email: "", signatureStatus: "pending" },
      { name: "Bilayl MATOU", role: "Président", organization: "GANDO SOLUTIONS", email: "", signatureStatus: "pending" },
    ],
    signatureSteps: [
      "Chaque signataire reçoit un lien personnel par email.",
      "Chaque page peut être paraphée avant la signature finale.",
      "La signature peut être manuscrite ou écrite avec le nom complet.",
      "Le document, les paraphes, les signatures et le journal d'audit sont figés par empreinte SHA-256.",
    ],
  };
}

export function normalizeSD05NativeContent(value: unknown): SD05Content {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const contractStatus: SD05Content["contractStatus"] = source.contractStatus === "internal_review" || source.contractStatus === "client_review" || source.contractStatus === "ready_to_sign" || source.contractStatus === "signed" ? source.contractStatus : "draft";
  const contractTemplate: SD05TemplateId = source.contractTemplate === "legal_convention" ? "legal_convention" : "gando_standard";
  return {
    contractTitle: clean(source.contractTitle, 500),
    contractReference: clean(source.contractReference, 300),
    contractVersion: clean(source.contractVersion, 100),
    contractUrl: clean(source.contractUrl, 2_000),
    contractStatus,
    contractSummary: clean(source.contractSummary, 60_000),
    contractTemplate,
    footerConfidentialityText: clean(source.footerConfidentialityText || SD05_DEFAULT_FOOTER, 3_000),
    emailIntroText: clean(source.emailIntroText, 2_000),
    allowTypedSignature: source.allowTypedSignature !== false,
    allowDrawnSignature: source.allowDrawnSignature !== false,
    requireInitialsEachPage: source.requireInitialsEachPage !== false,
    effectiveDate: clean(source.effectiveDate, 40),
    term: clean(source.term, 500),
    renewal: clean(source.renewal, 1_000),
    terminationNotice: clean(source.terminationNotice, 1_000),
    signatureDeadline: clean(source.signatureDeadline, 40),
    legalItems: Array.isArray(source.legalItems) ? source.legalItems.slice(0, 80).map(item => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const status = row.status === "approved" || row.status === "in_review" ? row.status : "open";
      return { topic: clean(row.topic, 500), status, owner: clean(row.owner, 300), notes: clean(row.notes, 2_000) };
    }).filter(item => item.topic) : [],
    signatories: Array.isArray(source.signatories) ? source.signatories.slice(0, 30).map(item => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const signatureStatus = row.signatureStatus === "sent" || row.signatureStatus === "signed" ? row.signatureStatus : "pending";
      return { name: clean(row.name, 300), role: clean(row.role, 300), organization: clean(row.organization, 300), email: clean(row.email, 500).toLowerCase(), signatureStatus };
    }).filter(item => item.name || item.email) : [],
    signatureSteps: cleanList(source.signatureSteps),
    finalConditions: cleanList(source.finalConditions),
    goLiveDate: clean(source.goLiveDate, 40),
    handoverPlan: cleanList(source.handoverPlan),
  };
}

export type ContractBlockKind = "major" | "article" | "subsection" | "bullet" | "paragraph";
export type ContractRenderBlock = { text: string; kind: ContractBlockKind };

export function contractBodyBlocks(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
}

export function contractBlockKind(block: string): ContractBlockKind {
  const value = block.trim();
  if (/^(PRÉAMBULE|PREAMBULE|ENTRÉE EN VIGUEUR|ENTREE EN VIGUEUR|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE ET JURIDICTION)$/i.test(value)) return "major";
  if (/^(ARTICLE\s+\d+|ANNEXE\s+\d+)/i.test(value)) return "article";
  if (/^\d+\.\d+\.?\s+/i.test(value)) return "subsection";
  if (/^(?:[-–•]\s+)/.test(value)) return "bullet";
  return "paragraph";
}

export function isContractHeading(block: string) {
  const kind = contractBlockKind(block);
  return kind === "major" || kind === "article";
}

function blockWeight(block: ContractRenderBlock) {
  if (block.kind === "major" || block.kind === "article") return 1.35 + Math.ceil(block.text.length / 520) * 0.25;
  if (block.kind === "subsection") return 0.9 + Math.ceil(block.text.length / 600) * 0.3;
  return Math.max(0.7, Math.ceil(block.text.length / 520) * 0.85);
}

export function paginateContractBlocks(body: string): ContractRenderBlock[][] {
  const source = contractBodyBlocks(body).map(text => ({ text, kind: contractBlockKind(text) }));
  if (!source.length) return [[]];
  const pages: ContractRenderBlock[][] = [];
  let page: ContractRenderBlock[] = [];
  let used = 0;
  const maxWeight = 6.2;
  for (const block of source) {
    const weight = blockWeight(block);
    if (page.length && used + weight > maxWeight) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(block);
    used += weight;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export function contractPageCount(content: SD05Content) {
  return paginateContractBlocks(content.contractSummary).length + 2;
}
