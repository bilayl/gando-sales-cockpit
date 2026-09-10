# Prospection Gando — modèle CRM canonique

## Principe

Le Sales Cockpit prospecte des **entreprises**. Une entreprise est le prospect / compte commercial. Un contact est uniquement une personne rattachée à cette entreprise. Un deal est une opportunité. Une activité est un appel, une note, une tâche ou un rendez-vous.

> Entreprise (prospect) → Contacts (personnes) → Deals (opportunités) → Activités

Il n'existe plus de pipeline de prospection Contact parallèle au pipeline Entreprise.

## Source de vérité

- **Company HubSpot** : objet commercial principal et source métier du statut de prospection.
- **Contact HubSpot** : identité et coordonnées d'une personne. Il ne porte pas le stade du compte.
- **Supabase `companies.id`** : UUID technique interne, réservé aux jointures locales.
- **Supabase `companies.hubspot_id`** : identifiant externe HubSpot de l'entreprise. C'est cet identifiant qui doit être utilisé dans les routes et appels API HubSpot.
- **Onoff** : source téléphonie. Un événement est rapproché du contact par le numéro puis du compte associé.

Ne jamais envoyer un UUID Supabase à une route HubSpot qui attend un `objectId` numérique.

## Règles métier

1. `/prospection` affiche une seule base de prospects : les entreprises.
2. Un compte n'apparaît qu'une fois, quel que soit le nombre de personnes qui lui sont rattachées.
3. La création d'un contact se fait depuis le contexte d'une entreprise ou d'un flux d'enrichissement identifié, pas comme un nouveau lead autonome.
4. Lire une fiche ne doit jamais modifier son stade commercial.
5. Un changement de stade dans le pipeline modifie uniquement l'entreprise. Il ne réécrit plus artificiellement le statut du contact de référence.
6. Les contacts servent aux appels, emails et identification des décideurs ; le compte porte qualification, attribution, priorité, rappel et pipeline.
7. Les deals restent des opportunités distinctes du stade de prospection.
8. Le sourcing crée d'abord une Company. Un Contact n'est créé que lorsqu'une personne réelle est identifiée.
9. Les contacts sans entreprise associée ne doivent pas alimenter la file de prospection tant qu'ils ne sont pas rapprochés d'un compte.

## Pipeline entreprise

| Étape Cockpit | `hs_lead_status` | Rôle |
| --- | --- | --- |
| Nouveau | `NEW` | compte importé, encore à qualifier |
| À contacter | `OPEN` | compte qualifié prêt au premier contact |
| Tentative | `ATTEMPTED_TO_CONTACT` | tentative sans conversion |
| Contact établi | `CONNECTED` | conversation établie |
| Démo prévue | `CONNECTED` + statut métier | rendez-vous planifié |
| À relancer | `BAD_TIMING` | rappel arrivé ou à programmer |
| Ultérieur | `BAD_TIMING` + date future | compte temporairement mis en sommeil |
| Opportunité | `OPEN_DEAL` | besoin qualifié / deal en cours |
| Gagné | `lifecyclestage=customer` | client |
| Pas intéressé / Perdu | `UNQUALIFIED` | sortie de la file active |

`À travailler` est conservé comme libellé métier historique de `NEW`. Le Cockpit l'affiche désormais comme **Nouveau** au lieu de le transformer automatiquement en `OPEN` lors d'une simple lecture.

## Localisation

La localisation appartient à la Company :

- `address`
- `address2`
- `zip`
- `city`
- `state`
- `country`

La modification depuis la fiche entreprise met à jour HubSpot puis le cache Supabase. Les colonnes locales dédiées `city`, `postal_code` et `country` sont synchronisées ; `address`, `address2` et `state` restent également conservés dans `raw_data.properties`.

## Sourcing

La page `/sourcing` utilise `bilayl/gando-enrichment-backend` comme moteur de découverte.

Flux obligatoire :

1. Le navigateur appelle `/api/enrichment/search` dans le Sales Cockpit.
2. La Route Handler Next.js appelle le backend avec la clé serveur ; aucune clé sensible n'est exposée au navigateur.
3. Le backend déduplique les candidats avec les entreprises déjà présentes.
4. L'utilisateur sélectionne explicitement les entreprises à importer.
5. Le backend refait le contrôle anti-doublon juste avant création.
6. Une entreprise créée démarre avec `hs_lead_status=NEW` / `statut_prospection=À travailler`.
7. Elle apparaît dans **Nouveau**, puis passe à **À contacter** uniquement par une action commerciale explicite.

## Règle d'évolution

Toute nouvelle donnée doit avoir un seul propriétaire métier :

- compte → Company ;
- personne → Contact ;
- opportunité → Deal ;
- action / historique → Activity, Task ou Meeting.

Une dénormalisation Supabase peut accélérer l'interface, mais elle ne doit jamais créer une seconde logique métier concurrente de HubSpot.
