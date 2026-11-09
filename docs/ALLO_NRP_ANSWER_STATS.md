# Statistiques des appels SDR — distinction réponse humaine / NRP

## Règle de vérité

Un appel techniquement \`ANSWERED\` ou \`TRANSFERRED\` peut aboutir sur un répondeur, une messagerie ou avoir été qualifié **NRP (« ne répond pas »)** par le SDR. Ces appels ne doivent pas être présentés comme des échanges avec le prospect.

Ordre de priorité :
1. Qualification explicite NRP / pas de réponse / messagerie / occupé / échec (tags ou résultat commercial) → **non répondu**, même si le résultat téléphonique était ANSWERED.
2. Issue explicitement CONNECTED / ANSWERED et sans qualification négative → **répondu**.
3. Statut manquant / en cours / indéterminé → **inconnu**, non compté parmi les répondus.

Les données HubSpot disposent de deux notions distinctes : \`hs_call_status\` (état technique) et \`hs_call_disposition\` (issue commerciale). Des appels \`COMPLETED\` sont effectivement classés \`No answer\` dans le CRM Gando. Le second doit primer pour le reporting SDR.

## Mesures

- **Total des appels** : tentatives distinctes de la période.
- **Répondus** : appels avec issue positive sans qualification négative NRP/messagerie.
- **Sans réponse** : échecs explicites, incluant les NRP et messages vocaux.
- **NRP** : sous-ensemble des non-répondus, pas une catégorie à additionner.
- **Inconnus** : résultat non exploitable, explicitement séparé.
- **Taux de réponse** : répondus / nombre total d'appels vérifiés, uniquement lorsque l'intégralité des appels de la période a été récupérée.
- Si la source n'a pas pu être interrogée ou le rapport est partiel : afficher **« — »** pour le taux et éviter de publier un taux calculé sur un simple échantillon.

Les autres mesures (transcription, actions, résumés) sont indépendantes de cette qualification.

## Exemples de régression

| Résultat téléphonie | Tags / issue | Comptage attendu |
| --- | --- | --- |
| ANSWERED | NRP | Non répondu (NRP) |
| ANSWERED | Messagerie | Non répondu |
| TRANSFERRED | no_answer | Non répondu |
| ANSWERED | Aucun indicateur négatif | Répondu (techniquement) |
| NO_ANSWER | Aucun | Non répondu |
| COMPLETED (HubSpot) | No answer (HubSpot) | Non répondu |
| QUEUED (HubSpot) | Connected (HubSpot) | Inconnu, pas répondu |
| COMPLETED (HubSpot) | Connected (HubSpot) | Répondu |

Le Cockpit ne doit pas inférer une réponse humaine à partir d'une durée positive, d'une transcription, d'un résumé automatique ou de la seule propriété technique « Completed ».
