# Audit HubSpot — module Rendez-vous

Date de l'audit : 13 août 2026.

## Modèle de données retenu

Le module réutilise exclusivement les activités `Meeting` natives de HubSpot et leurs associations natives vers les contacts, sociétés et deals.

| Besoin | Donnée HubSpot utilisée |
| --- | --- |
| Date et heure | `hs_meeting_start_time`, `hs_meeting_end_time` |
| Statut | `hs_meeting_outcome` : `SCHEDULED`, `COMPLETED`, `RESCHEDULED`, `NO_SHOW`, `CANCELED` |
| Notes de compte-rendu | `hs_internal_meeting_notes` |
| Type et source | `hs_activity_type`, `hs_object_source_label`, `hs_meeting_location_type` |
| Prochaine activité | `notes_next_activity_date`, calculée nativement par HubSpot à partir des activités associées |
| Prochaine étape du deal | `hs_next_step` |
| Résultat commercial du contact | propriété existante `statut_prospection` |
| Qualification | propriété native `lifecyclestage`, uniquement en progression vers `opportunity` |

Aucune propriété parallèle de rendez-vous n'a été créée.

## Associations natives vérifiées

| Association | Type ID HubSpot |
| --- | ---: |
| Meeting → Contact | 200 |
| Meeting → Société | 188 |
| Meeting → Deal | 212 |
| Tâche → Contact | 204 |
| Tâche → Société | 192 |
| Tâche → Deal | 216 |

## Audit WF01

La lecture des workflows du portail a été tentée via l'API Automation. HubSpot a répondu `403 Forbidden` car l'application privée actuellement configurée ne possède pas le scope `automation`.

Conséquence : la couverture exacte de WF01 ne peut pas être certifiée depuis le dépôt. Pour éviter un doublon, aucun workflow, webhook ou automatisme asynchrone parallèle n'a été ajouté.

Les seules écritures automatiques du module sont déclenchées par une action explicite d'un commercial dans le cockpit :

- création d'une tâche de prochaine action associée aux objets concernés ;
- mise à jour du résultat natif du Meeting ;
- ajout du compte-rendu dans les notes internes du Meeting ;
- mise à jour de la prochaine étape du deal et, si demandé, de la qualification du contact ;
- création d'un nouveau Meeting lors d'une replanification et conservation de l'ancien en `RESCHEDULED`.

## Contrôle recommandé avant activation d'automatismes HubSpot

1. Ajouter temporairement le scope `automation` à une application d'audit.
2. Exporter les déclencheurs, actions et critères d'inscription de WF01.
3. Comparer WF01 aux événements `NO_SHOW`, `CANCELED` et `COMPLETED` du module.
4. Conserver une seule source d'automatisation pour chaque action de suivi.
