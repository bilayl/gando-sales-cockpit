import type { SD05Content } from "@/lib/sd-stage-content";

export const SD05_SIGNATURE_CONSENT =
  "Je reconnais avoir lu le contrat dans son intégralité, je confirme mon identité et mon pouvoir de représenter l'organisation indiquée, et j'accepte de signer électroniquement ce document. Je comprends que mon nom, mon adresse email, la date et l'heure, les informations techniques de connexion et l'empreinte du document seront conservés comme éléments de preuve.";

export const SD05_TEMPLATE_VERSION = "GANDO-SD05-2026-08";

const TEMPLATE_BODY = `PRÉAMBULE
Gando édite une solution numérique destinée aux professionnels de la location, permettant notamment de digitaliser le dépôt de garantie, d'évaluer l'éligibilité d'un Client Final et d'organiser, le cas échéant, l'encaissement de sommes contractuellement dues au Loueur utilisateur.

Le Loueur utilisateur exerce une activité professionnelle de location et souhaite utiliser les Services afin de limiter l'immobilisation initiale des fonds de ses Clients Finaux tout en sécurisant son processus de recouvrement.

Les Parties reconnaissent que Gando n'est ni un établissement de crédit, ni une entreprise d'assurance, ni, sauf agrément exprès ultérieur, un prestataire de services de paiement. Les services réglementés de paiement et d'accès aux données bancaires sont exécutés par des prestataires habilités, selon leurs propres conditions.

Les Parties ont en conséquence convenu ce qui suit. Le Préambule et les Annexes font partie intégrante du Contrat.

ARTICLE 1 : DÉFINITIONS
« Caution / Dépôt de garantie » : montant stipulé au contrat de location afin de garantir les sommes pouvant devenir dues par le Client Final, sans blocage initial de ce montant sur son compte, sous réserve du parcours Gando.

« Frais de Sécurisation » : commission prélevée par Gando sur le montant de la Caution, payée par le Client Final.

« Frais d'encaissement » : frais prélevés par Gando en cas de sinistre, payés par le Loueur.

« Contrat » : le présent contrat, son Préambule, ses Annexes et tout avenant signé.

« Contrat de location » : ensemble formé par les conditions particulières de la réservation ou de la location, les CGL acceptées et, le cas échéant, les options et états des lieux opposables au Client Final.

« Demande d'Encaissement » : demande documentée du Loueur utilisateur portant sur une créance certaine, liquide et exigible résultant du Contrat de location.

« Garantie d'Encaissement » : engagement contractuel de paiement de Gando, distinct d'un contrat d'assurance, applicable uniquement aux Cautions Éligibles et sous réserve des conditions prévues au Contrat.

« Prestataire Réglementé » : établissement agréé ou habilité réalisant les services de paiement, l'authentification, l'open banking ou la conservation réglementaire des données.

« Services » : ensemble des services, API et interfaces web de Gando.

« Caution Éligible » : Caution activée par Gando respectant cumulativement le Contrat et les paramètres applicables.

« Client Final » : personne physique ou morale concluant un Contrat de location avec le Loueur utilisateur et utilisant le parcours Gando.

ARTICLE 2 : OBJET ET PÉRIMÈTRE
Le Contrat définit les conditions dans lesquelles Gando concède au Loueur utilisateur un accès professionnel, personnel et non exclusif aux Services. Les Services couvrent notamment la création et le suivi d'une Caution, le parcours d'éligibilité du Client Final, l'enregistrement d'un moyen de paiement ou d'un mandat technique sans immobilisation initiale du montant de la Caution, les tentatives d'encaissement des montants devenus dus et documentés, la Garantie d'Encaissement lorsque ses conditions sont réunies et les fonctions de paiement activées avec un Prestataire Réglementé.

Le Contrat ne modifie pas la relation de location entre le Loueur utilisateur et le Client Final. Le Loueur utilisateur demeure seul loueur et seul responsable du bien loué, du Contrat de location, de ses CGL, des états des lieux, de la justification des sommes réclamées et de ses obligations envers le Client Final.

ARTICLE 3 : DOCUMENTS CONTRACTUELS ET OPPOSABILITÉ
Les CGUV Gando applicables au Loueur, annexes comprises, sont incorporées au Contrat. Le Loueur utilisateur reconnaît avoir pu les consulter, les télécharger et les conserver avant la signature.

Pour la relation entre Gando et le Loueur utilisateur, l'ordre de priorité décroissant est : (1) la Fiche de validation, uniquement pour les paramètres renseignés et validés ; (2) le corps du Contrat ; (3) les Annexes ; (4) les CGUV Gando ; puis (5) la documentation technique, sauf stipulation expresse contraire.

Les Conditions générales de location du Loueur régissent exclusivement la relation entre le Loueur utilisateur et le Client Final. Le Loueur conserve la version remise au Client Final ainsi que la preuve de son acceptation.

ARTICLE 4 : MISE EN SERVICE ET ACCÈS
La mise en production est subordonnée à la vérification de l'identité du Loueur utilisateur et de ses représentants, à la remise des documents KYB demandés, à la configuration du compte, à la transmission de ses CGL, à l'acceptation des conditions applicables et au règlement des sommes exigibles.

Les identifiants sont personnels. Le Loueur utilisateur protège ses mots de passe, limite les droits d'accès à ses collaborateurs habilités et informe immédiatement Gando de toute compromission.

ARTICLE 5 : ÉLIGIBILITÉ DES CAUTIONS ET TERRITOIRE
Une Caution n'est Éligible que si elle concerne une location réelle et licite, respecte les montants et durées convenus, a été activée selon le parcours Gando, a donné lieu aux consentements et paiements requis, repose sur un Contrat de location opposable et sur des preuves suffisantes, et ne présente pas d'indice de fraude, de collusion ou de contournement.

Gando demeure libre d'accepter, de refuser ou de soumettre une Caution à des vérifications complémentaires selon son modèle de risque, les exigences de ses prestataires et la réglementation applicable.

ARTICLE 6 : DEMANDE D'ENCAISSEMENT ET GARANTIE
Le Loueur utilisateur dépose depuis son espace Gando une Demande d'Encaissement documentée pendant la Durée de Sécurisation. Gando vérifie la complétude et l'éligibilité du dossier et met en œuvre les étapes de recouvrement prévues par les conditions applicables.

Toute avance au titre de la Garantie d'Encaissement est subordonnée au respect cumulatif des conditions d'éligibilité, des justificatifs requis et des plafonds convenus. Les exclusions prévues par le Contrat et les CGUV Gando demeurent applicables.

ARTICLE 7 : OBLIGATIONS DE GANDO
Gando s'engage à fournir les Services avec diligence selon une obligation de moyens, traiter les Cautions Éligibles et les Demandes d'Encaissement conformément au Contrat, mettre à disposition la documentation nécessaire, informer le Loueur des incidents significatifs dans la mesure utile, recourir à des prestataires présentant des garanties appropriées et respecter ses obligations légales en matière de données et de sécurité.

ARTICLE 8 : OBLIGATIONS DU LOUEUR UTILISATEUR
Le Loueur utilisateur s'engage notamment à utiliser les Services uniquement pour ses propres locations, transmettre des informations complètes et exactes, conserver les justificatifs utiles, maintenir ses CGL et assurances conformes, réaliser les états des lieux nécessaires, présenter au Client Final les informations requises avant engagement, coopérer aux contrôles de fraude, de conformité et de recouvrement, et ne pas contourner le parcours Gando.

ARTICLE 9 : CONDITIONS FINANCIÈRES
Les conditions financières particulières sont celles figurant sur la Fiche de validation et dans l'encadré « Structure tarifaire » du présent SD05. Les montants HT, taxes applicables et montants TTC sont distingués conformément au régime fiscal applicable.

Les Frais d'Encaissement, éventuelles récompenses commerciales, mécanismes de maîtrise de la sinistralité et autres paramètres particuliers sont ceux expressément convenus entre les Parties.

ARTICLE 10 : PAIEMENTS ET PRESTATAIRES RÉGLEMENTÉS
Les opérations de paiement, la tenue éventuelle de comptes de paiement ou de monnaie électronique, l'authentification forte et l'accès aux données de compte sont réalisés par un ou plusieurs Prestataires Réglementés. Le Loueur utilisateur et/ou le Client Final peuvent devoir accepter leurs conditions, fournir des informations KYC/KYB et se soumettre à leurs contrôles.

ARTICLE 11 : DONNÉES PERSONNELLES
Les rôles de chaque Partie sont déterminés traitement par traitement. Chaque Partie assure la licéité, la transparence, la minimisation, l'exactitude, la sécurité et la conservation limitée des données relevant de sa responsabilité. Les Parties coopèrent raisonnablement pour répondre aux droits des personnes, demandes d'autorité et incidents.

ARTICLE 12 : SÉCURITÉ ET CONTINUITÉ
Chaque Partie met en œuvre des mesures techniques et organisationnelles proportionnées, incluant notamment le contrôle des accès, l'authentification, le chiffrement des flux, la journalisation, les sauvegardes, la gestion des vulnérabilités et une procédure de réponse aux incidents.

ARTICLE 13 : CONFIDENTIALITÉ
Chaque Partie protège les informations non publiques de l'autre Partie et ne les utilise que pour exécuter le Contrat. L'obligation de confidentialité s'applique pendant le Contrat et cinq (5) ans après son terme, sans préjudice des durées légales ou de la nature des informations concernées.

ARTICLE 14 : PROPRIÉTÉ INTELLECTUELLE ET RÉFÉRENCES
Chaque Partie conserve ses droits antérieurs. Gando demeure titulaire de sa plateforme, de ses API, algorithmes, modèles de risque, bases, interfaces, documentations, marques et évolutions. Le Contrat ne transfère aucun droit de propriété.

ARTICLE 15 : RESPONSABILITÉ ET ASSURANCES
Chaque Partie répond des dommages directs et prévisibles causés à l'autre par son manquement prouvé. Le Loueur utilisateur demeure responsable de la location, du bien loué, de ses CGL, de ses états des lieux, de la légitimité de sa créance et de sa relation avec le Client Final.

Chaque Partie maintient des assurances adaptées à son activité. La Garantie d'Encaissement ne remplace aucune assurance obligatoire ou usuelle du Loueur utilisateur.

ARTICLE 16 : SOUS-TRAITANCE ET CESSION
Gando peut sous-traiter tout ou partie des Services à des hébergeurs et prestataires techniques, de paiement, d'open banking, de fraude ou de recouvrement, tout en restant responsable de ses obligations propres dans les limites du Contrat.

ARTICLE 17 : DURÉE ET RENOUVELLEMENT
Le Contrat entre en vigueur à sa date de dernière signature pour la préparation et la mise en service. Les opérations en production débutent à la date renseignée sur la Fiche de validation. La durée initiale, le renouvellement et le préavis sont ceux indiqués dans les conditions particulières du présent SD05.

ARTICLE 18 : SUSPENSION
Gando peut suspendre tout ou partie des Services en cas de risque de fraude ou de sécurité, activité interdite, exigence d'une autorité ou d'un Prestataire Réglementé, informations KYC/KYB manquantes, violation grave du Contrat ou impayé dans les conditions prévues.

ARTICLE 19 : RÉSILIATION ET EFFETS
En cas de manquement substantiel non réparé après mise en demeure, l'autre Partie peut résilier le Contrat conformément aux délais convenus. La résiliation peut être immédiate en cas de fraude, atteinte grave à la sécurité, usage illicite ou manquement rendant impossible le maintien de la relation.

À la date d'effet de la résiliation, les nouveaux dossiers sont désactivés. Les dossiers valablement acceptés avant la résiliation restent traités jusqu'à leur terme, sous réserve du paiement des frais et du respect du Contrat.

ARTICLE 20 : FORCE MAJEURE
Aucune Partie n'est responsable d'un manquement empêché par un événement de force majeure au sens de l'article 1218 du Code civil. La Partie affectée informe l'autre sans délai, limite les conséquences et reprend l'exécution dès que possible.

ARTICLE 21 : DISPOSITIONS GÉNÉRALES
Les Parties sont des cocontractants indépendants. Le Contrat ne crée ni société commune, ni mandat général, ni agence commerciale, ni exclusivité.

Les notifications opérationnelles sont adressées par email aux contacts convenus. Toute modification substantielle du Contrat est écrite et signée.

PREUVE ET SIGNATURE ÉLECTRONIQUE
Les journaux, traces d'authentification, horodatages, emails, documents déposés et enregistrements des systèmes font preuve jusqu'à preuve contraire. La signature électronique produit les mêmes effets que la signature manuscrite, sous réserve de l'identification des signataires et de l'intégrité du document.

DROIT APPLICABLE ET JURIDICTION
Le Contrat et les CGUV Gando sont soumis au droit français. Avant toute action, les Parties tentent une résolution amiable dans les conditions prévues au Contrat. À défaut, la juridiction compétente est celle prévue par les conditions contractuelles applicables.

ANNEXE 1 : CONDITIONS FINANCIÈRES ET COMMERCIALES
Les conditions financières détaillées figurent dans la Fiche de validation, dans l'encadré « Structure tarifaire » et, le cas échéant, dans toute annexe commerciale expressément intégrée au Contrat.

ANNEXE 2 : DOSSIER D'ENCAISSEMENT
Pour chaque Demande d'Encaissement, le Loueur utilisateur conserve et transmet les justificatifs prévus par les CGUV Gando et les conditions particulières, notamment le Contrat de location signé ou accepté, la version horodatée des CGL applicable et la preuve de leur présentation et acceptation, les états des lieux et les justificatifs de la créance.

ANNEXE 3 : CLAUSE À INTÉGRER AUX CONDITIONS GÉNÉRALES DE LOCATION
Le Loueur utilisateur veille à intégrer à ses Conditions générales de location la clause Gando applicable ou une clause d'effet juridique équivalent, adaptée au parcours effectivement proposé au Client Final.`;

function clean(value: unknown, max = 60_000) {
  return String(value || "").trim().slice(0, max);
}

function cleanList(value: unknown, maxItems = 80) {
  return Array.isArray(value) ? value.map(item => clean(item, 2_000)).filter(Boolean).slice(0, maxItems) : [];
}

export function createGandoSD05Template(companyName = "Client"): SD05Content {
  return {
    contractTitle: `Convention de services Gando × ${companyName}`,
    contractReference: `SD05-${new Date().getFullYear()}-`,
    contractVersion: SD05_TEMPLATE_VERSION,
    contractUrl: "",
    contractStatus: "draft",
    contractSummary: TEMPLATE_BODY,
    effectiveDate: "",
    term: "12 mois à compter de la date de mise en production",
    renewal: "Renouvellement tacite par périodes de 12 mois, sauf dénonciation dans le délai contractuel.",
    terminationNotice: "Préavis contractuel à compléter avant envoi en signature.",
    signatureDeadline: "",
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
      "Le signataire confirme son identité, accepte la signature électronique et saisit son nom complet.",
      "La date, l'heure, l'email, les informations techniques de connexion et le journal d'audit sont conservés comme éléments de preuve.",
    ],
    finalConditions: [],
    goLiveDate: "",
    handoverPlan: [],
  };
}

export function normalizeSD05NativeContent(value: unknown): SD05Content {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const contractStatus: SD05Content["contractStatus"] = source.contractStatus === "internal_review" || source.contractStatus === "client_review" || source.contractStatus === "ready_to_sign" || source.contractStatus === "signed" ? source.contractStatus : "draft";
  return {
    contractTitle: clean(source.contractTitle, 500),
    contractReference: clean(source.contractReference, 300),
    contractVersion: clean(source.contractVersion, 100),
    contractUrl: clean(source.contractUrl, 2_000),
    contractStatus,
    contractSummary: clean(source.contractSummary, 60_000),
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

export function contractBodyBlocks(body: string) {
  return body
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
}

export function isContractHeading(block: string) {
  return /^(PRÉAMBULE|ARTICLE\s+\d+|ANNEXE\s+\d+|PREUVE ET SIGNATURE ÉLECTRONIQUE|DROIT APPLICABLE ET JURIDICTION)/i.test(block);
}
