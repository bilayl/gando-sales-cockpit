# Company-first Prospection — Source of truth

## Principe

Le Sales Cockpit prospecte des **entreprises**. Les contacts sont les personnes à appeler au sein de ces entreprises. Les deals représentent les opportunités commerciales. Les activités représentent l'historique et les prochaines actions.

> Entreprise → Contacts → Deals → Activités / tâches / rendez-vous

## Règles métier

1. L'entreprise est l'objet principal de la page `/prospection`.
2. Un même compte ne doit pas apparaître plusieurs fois parce qu'il possède plusieurs contacts.
3. Un résultat d'appel est enregistré sur le contact appelé **et** remonte au niveau entreprise afin que le statut du compte reste exploitable dans le board.
4. Un rappel doit créer/maintenir une prochaine action et mettre à jour la date de rappel de l'entreprise.
5. Les deals restent des opportunités indépendantes du statut de prospection du compte.
6. La fiche entreprise doit donner accès aux contacts, rendez-vous, notes, deals et tâches associés.
7. La vue Contacts reste disponible comme vue secondaire, mais ne pilote plus la prospection par défaut.

## Mapping HubSpot entreprise

- `hs_lead_status` : progression commerciale du compte.
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
| Opportunité | `OPEN_DEAL` |
| Non qualifié | `UNQUALIFIED` |

## Résultats d'appel

- `NRP`, `Occupé` → entreprise `ATTEMPTED_TO_CONTACT` sauf rappel explicite.
- `À rappeler`, `À une date ultérieure` → entreprise `BAD_TIMING` + `date_de_rappel`.
- `Intéressé`, `Intéressé mais`, `En attente décision` → entreprise `CONNECTED`.
- `RDV pris` → entreprise `OPEN_DEAL` (ou `CONNECTED` si aucun deal n'existe encore ; le Cockpit peut faire évoluer cette règle plus tard).
- `Hors cible`, `Numéro invalide` → entreprise `UNQUALIFIED`.

## Évolution

Toute nouvelle fonctionnalité de prospection doit répondre à la question : **est-ce une information de compte, de personne, d'opportunité ou d'activité ?**

- Compte → Company
- Personne → Contact
- Opportunité → Deal
- Action / historique → Activity / Task / Meeting

Ne jamais dupliquer une donnée de manière divergente entre ces objets. Lorsque le Cockpit dénormalise une information pour accélérer l'interface, HubSpot reste la source métier et Supabase reste la couche de lecture/synchronisation.
