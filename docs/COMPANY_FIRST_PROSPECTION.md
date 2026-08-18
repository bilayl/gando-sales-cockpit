# Company-first Prospection — Source of truth

## Principe

Le Sales Cockpit prospecte des **entreprises**. Les contacts sont les personnes à appeler au sein de ces entreprises. Les deals représentent les opportunités commerciales. Les activités représentent l'historique et les prochaines actions.

> Entreprise → Contacts → Deals → Activités / tâches / rendez-vous

## Règles métier

1. L'entreprise est l'objet principal de la page `/prospection`.
2. Un même compte ne doit pas apparaître plusieurs fois parce qu'il possède plusieurs contacts.
3. Un résultat d'appel est enregistré sur le contact appelé **et** remonte au niveau entreprise afin que le statut du compte reste exploitable dans le board.
4. Les relances sont pilotées par les propriétés HubSpot et les workflows HubSpot WF01–WF04 ; le Cockpit ne doit pas créer une automatisation parallèle générant des doublons.
5. Les deals restent des opportunités indépendantes du statut de prospection du compte.
6. La fiche entreprise doit donner accès aux contacts, rendez-vous, notes, deals et tâches associés.
7. La vue Contacts reste disponible comme vue secondaire, mais ne pilote plus la prospection par défaut.
8. Le sourcing crée d'abord des **Companies**. Il ne doit pas inventer ou créer automatiquement un Contact ou un Deal tant qu'une personne ou une opportunité réelle n'a pas été identifiée.

## Mapping HubSpot entreprise

- `hs_lead_status` : progression commerciale du compte.
- `statut_prospection` : libellé métier du pipeline Company du Cockpit.
- `statut_de_lappel` : dernier résultat d'appel significatif remonté au compte.
- `date_de_rappel` : prochain rappel du compte.
- `notes_last_updated` / `hs_last_sales_activity_timestamp` : dernière activité.
- `notes_next_activity_date` : prochaine activité calculée par HubSpot.

### Colonnes du board

| Colonne Cockpit | `hs_lead_status` |
| --- | --- |
| À travailler | `NEW` |
| À contacter | `OPEN` |
| Tentative | `ATTEMPTED_TO_CONTACT` |
| Contact établi | `CONNECTED` |
| À relancer | `BAD_TIMING` |
| Ultérieur | `BAD_TIMING` + date future + statut appel long terme |
| Opportunité | `OPEN_DEAL` |
| Perdu | `UNQUALIFIED` |
| Gagné | `lifecyclestage=customer` |

## Résultats d'appel

- `NRP` → entreprise `ATTEMPTED_TO_CONTACT`, contact `En prospection + Sans réponse` pour WF02.
- `Occupé`, `À rappeler`, `Intéressé mais` → entreprise `BAD_TIMING / À relancer`, contact alimenté pour WF03.
- `À une date ultérieure` → entreprise `BAD_TIMING / Ultérieur`, contact `À recycler` + `date_recyclage` pour WF04.
- `Intéressé` → entreprise `CONNECTED`, contact `Conversation`.
- `RDV pris` → entreprise `OPEN_DEAL / Opportunité`, contact `RDV booké + RDV obtenu`.
- `Pas intéressé`, `Hors cible`, `Numéro invalide` → sortie de la file active selon le niveau de qualification correspondant.

## Sourcing

La page `/sourcing` utilise `bilayl/gando-enrichment-backend` comme moteur de découverte.

Flux obligatoire :

1. Le navigateur appelle uniquement `/api/enrichment/search` dans le Sales Cockpit.
2. La Route Handler Next.js appelle le backend via `X-Gando-Api-Key` ; la clé n'est jamais exposée au navigateur.
3. Le backend effectue la recherche web et compare les candidats à l'ensemble des entreprises HubSpot.
4. Seules les entreprises absentes de HubSpot sont proposées dans l'interface.
5. L'utilisateur sélectionne explicitement les entreprises à importer.
6. `/api/enrichment/import` appelle le backend, qui refait un contrôle anti-doublon juste avant création.
7. Une nouvelle entreprise est créée dans HubSpot avec `hs_lead_status=NEW` et `statut_prospection=À travailler`, puis synchronisée dans Supabase.
8. Le nouveau compte devient visible dans `/prospection` et suit ensuite le workflow Company-first normal.

Ne jamais exposer `INTERNAL_API_KEY`, `OPENROUTER_API_KEY` ou `HUBSPOT_ACCESS_TOKEN` au navigateur.

## Évolution

Toute nouvelle fonctionnalité de prospection doit répondre à la question : **est-ce une information de compte, de personne, d'opportunité ou d'activité ?**

- Compte → Company
- Personne → Contact
- Opportunité → Deal
- Action / historique → Activity / Task / Meeting

Ne jamais dupliquer une donnée de manière divergente entre ces objets. Lorsque le Cockpit dénormalise une information pour accélérer l'interface, HubSpot reste la source métier et Supabase reste la couche de lecture/synchronisation.
